"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, fromForm } from "@/lib/actions/shared";
import { hashPassword } from "@/lib/auth/password";
import { createCheckoutSession, createPortalSession } from "@/lib/billing/stripe";
import { audit, requireDashboard } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { normalizeHostname } from "@/lib/domains/instructions";
import { addDomain as addDomainService, checkDomain } from "@/lib/domains/service";
import { canUseCustomDomain, canUseTemplate } from "@/lib/entitlements";
import { parseRRule } from "@/lib/events/recurrence";
import { fromFloating } from "@/lib/events/timezone";
import { applyLodgeInfo, LODGE_INFO_KEYS } from "@/lib/lodge-info";
import { deleteObject, newObjectKey, putObject, validateImageUpload } from "@/lib/storage";
import { lodgeSubdomainUrl } from "@/lib/urls";
import {
  emailSchema,
  eventSchema,
  formBool,
  formString,
  lodgeInfoSchema,
  officerSchema,
  pageSchema,
  passwordSchema,
} from "@/lib/validation";
import { getTemplate, isTemplateId } from "@/templates/registry";
import type { ActionResult } from "@/components/ActionForm";

type Result = Promise<ActionResult>;

// ---------------------------------------------------------------------------
// Lodge info & images
// ---------------------------------------------------------------------------

export async function updateLodgeInfo(_prev: ActionResult, fd: FormData): Result {
  try {
    const ctx = await requireDashboard("EDITOR");
    const { data, addressChanged } = applyLodgeInfo(ctx.lodge, lodgeInfoSchema.parse(fromForm(fd, LODGE_INFO_KEYS)));
    await ctx.db.lodge.update({ where: { id: ctx.lodge.id }, data });
    await audit(ctx, "lodge.info_updated");
    revalidatePath("/dashboard");
    return { ok: addressChanged ? "Saved. The map will update once the new address is located." : "Saved." };
  } catch (err) {
    return fail(err);
  }
}

export async function uploadLodgeImage(_prev: ActionResult, fd: FormData): Result {
  try {
    const ctx = await requireDashboard("EDITOR");
    const kind = formString(fd, "kind") === "seal" ? "seal" : "logo";
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Choose an image file" };
    const img = await validateImageUpload(await file.arrayBuffer());
    const key = newObjectKey(ctx.lodge.id, kind, img.ext);
    await putObject(key, img.buffer, img.mime);
    const previous = kind === "logo" ? ctx.lodge.logoKey : ctx.lodge.sealKey;
    await ctx.db.lodge.update({ where: { id: ctx.lodge.id }, data: kind === "logo" ? { logoKey: key } : { sealKey: key } });
    if (previous) await deleteObject(previous).catch(() => undefined);
    await audit(ctx, `lodge.${kind}_uploaded`, { key });
    revalidatePath("/dashboard/content");
    return { ok: `${kind === "logo" ? "Logo" : "Seal"} updated.` };
  } catch (err) {
    return fail(err);
  }
}

export async function removeLodgeImage(_prev: ActionResult, fd: FormData): Result {
  try {
    const ctx = await requireDashboard("EDITOR");
    const kind = formString(fd, "kind") === "seal" ? "seal" : "logo";
    const previous = kind === "logo" ? ctx.lodge.logoKey : ctx.lodge.sealKey;
    await ctx.db.lodge.update({ where: { id: ctx.lodge.id }, data: kind === "logo" ? { logoKey: null } : { sealKey: null } });
    if (previous) await deleteObject(previous).catch(() => undefined);
    revalidatePath("/dashboard/content");
    return { ok: "Removed." };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Template & publishing
// ---------------------------------------------------------------------------

export async function setTemplate(_prev: ActionResult, fd: FormData): Result {
  try {
    const ctx = await requireDashboard("ADMIN");
    const templateId = formString(fd, "templateId") ?? "";
    if (!isTemplateId(templateId)) return { error: "Unknown template" };
    const template = getTemplate(templateId);
    if (!canUseTemplate(ctx.lodge, template)) return { error: `${template.name} requires the paid plan` };
    await ctx.db.lodge.update({ where: { id: ctx.lodge.id }, data: { templateId } });
    await audit(ctx, "lodge.template_changed", { templateId });
    revalidatePath("/dashboard/template");
    return { ok: `Switched to ${template.name}. All your content is intact.` };
  } catch (err) {
    return fail(err);
  }
}

export async function setPublished(_prev: ActionResult, fd: FormData): Result {
  try {
    const ctx = await requireDashboard("ADMIN");
    const published = formString(fd, "published") === "true";
    if (ctx.lodge.status !== "APPROVED") return { error: "Your lodge has not been approved yet" };
    await ctx.db.lodge.update({ where: { id: ctx.lodge.id }, data: { published } });
    await audit(ctx, published ? "lodge.published" : "lodge.unpublished");
    revalidatePath("/dashboard");
    return { ok: published ? "Your site is live." : "Your site is hidden (visitors see a coming-soon page)." };
  } catch (err) {
    return fail(err);
  }
}

export async function resubmitForReview(): Promise<void> {
  const ctx = await requireDashboard("ADMIN");
  if (ctx.lodge.status === "REJECTED") {
    await ctx.db.lodge.update({ where: { id: ctx.lodge.id }, data: { status: "PENDING_REVIEW", submittedAt: new Date(), rejectionReason: null } });
    await audit(ctx, "lodge.resubmitted");
  }
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// Officers
// ---------------------------------------------------------------------------

export async function saveOfficer(_prev: ActionResult, fd: FormData): Result {
  try {
    const ctx = await requireDashboard("EDITOR");
    const data = officerSchema.parse(fromForm(fd, ["title", "name"]));
    const order = Number(formString(fd, "order") ?? "0") || 0;
    const id = formString(fd, "id");
    if (id) {
      await ctx.db.officer.update({ where: { id }, data: { ...data, order } });
    } else {
      const count = await ctx.db.officer.count();
      await ctx.db.officer.create({ data: { ...data, order: order || count } });
    }
    revalidatePath("/dashboard/officers");
    return { ok: "Officer saved." };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteOfficer(_prev: ActionResult, fd: FormData): Result {
  try {
    const ctx = await requireDashboard("EDITOR");
    const id = formString(fd, "id") ?? "";
    await ctx.db.officer.deleteMany({ where: { id } });
    revalidatePath("/dashboard/officers");
    return { ok: "Removed." };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

export async function uploadGalleryImage(_prev: ActionResult, fd: FormData): Result {
  try {
    const ctx = await requireDashboard("EDITOR");
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Choose an image file" };
    const img = await validateImageUpload(await file.arrayBuffer());
    const key = newObjectKey(ctx.lodge.id, "gallery", img.ext);
    await putObject(key, img.buffer, img.mime);
    const count = await ctx.db.galleryImage.count();
    await ctx.db.galleryImage.create({ data: { key, caption: (formString(fd, "caption") ?? "").slice(0, 200) || null, order: count } });
    revalidatePath("/dashboard/gallery");
    return { ok: "Photo added." };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteGalleryImage(_prev: ActionResult, fd: FormData): Result {
  try {
    const ctx = await requireDashboard("EDITOR");
    const id = formString(fd, "id") ?? "";
    const img = await ctx.db.galleryImage.findUnique({ where: { id } });
    if (!img) return { error: "Photo not found" };
    await ctx.db.galleryImage.delete({ where: { id } });
    await deleteObject(img.key).catch(() => undefined);
    revalidatePath("/dashboard/gallery");
    return { ok: "Photo removed." };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export async function savePage(_prev: ActionResult, fd: FormData): Result {
  try {
    const ctx = await requireDashboard("EDITOR");
    const data = pageSchema.parse({ ...fromForm(fd, ["title", "slug", "bodyHtml"]), published: formBool(fd, "published") });
    const id = formString(fd, "id");
    const clash = await ctx.db.page.findFirst({ where: { slug: data.slug, ...(id ? { NOT: { id } } : {}) } });
    if (clash) return { error: "Another page already uses that slug" };
    if (id) {
      await ctx.db.page.update({ where: { id }, data });
    } else {
      const count = await ctx.db.page.count();
      const page = await ctx.db.page.create({ data: { ...data, order: count } });
      revalidatePath("/dashboard/pages");
      redirect(`/dashboard/pages/${page.id}?saved=1`);
    }
    revalidatePath("/dashboard/pages");
    return { ok: "Page saved." };
  } catch (err) {
    return fail(err);
  }
}

export async function deletePage(_prev: ActionResult, fd: FormData): Result {
  try {
    const ctx = await requireDashboard("EDITOR");
    await ctx.db.page.deleteMany({ where: { id: formString(fd, "id") ?? "" } });
    revalidatePath("/dashboard/pages");
    redirect("/dashboard/pages");
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** datetime-local input ("YYYY-MM-DDTHH:mm") in the lodge timezone -> instant */
function parseLocalDateTime(value: string | undefined, tz: string): Date | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const floating = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0));
  return fromFloating(floating, tz);
}

export async function saveEvent(_prev: ActionResult, fd: FormData): Result {
  try {
    const ctx = await requireDashboard("EDITOR");
    const tz = ctx.lodge.timezone;
    const startsAt = parseLocalDateTime(formString(fd, "startsAt"), tz);
    if (!startsAt) return { error: "Start date/time is required" };
    const endsAt = parseLocalDateTime(formString(fd, "endsAt"), tz);
    const until = parseLocalDateTime(formString(fd, "until"), tz);
    const data = eventSchema.parse({
      ...fromForm(fd, ["title", "description", "location", "rrule"]),
      startsAt,
      endsAt,
      until: until ? new Date(until.getTime() + 24 * 3600 * 1000 - 1) : null,
      allDay: formBool(fd, "allDay"),
    });
    if (data.endsAt && data.endsAt < data.startsAt) return { error: "End must be after start" };
    if (data.rrule) parseRRule(data.rrule); // throws RecurrenceError
    const id = formString(fd, "id");
    if (id) {
      await ctx.db.event.update({ where: { id }, data });
    } else {
      await ctx.db.event.create({ data });
    }
    revalidatePath("/dashboard/events");
    redirect("/dashboard/events?saved=1");
  } catch (err) {
    return fail(err);
  }
}

export async function deleteEvent(_prev: ActionResult, fd: FormData): Result {
  try {
    const ctx = await requireDashboard("EDITOR");
    await ctx.db.event.deleteMany({ where: { id: formString(fd, "id") ?? "" } });
    revalidatePath("/dashboard/events");
    redirect("/dashboard/events");
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function addMember(_prev: ActionResult, fd: FormData): Result {
  try {
    const ctx = await requireDashboard("ADMIN");
    const email = emailSchema.parse(formString(fd, "email") ?? "");
    const role = formString(fd, "role") === "ADMIN" ? "ADMIN" : "EDITOR";
    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      const password = formString(fd, "password") ?? "";
      const name = (formString(fd, "name") ?? "").trim().slice(0, 120) || email.split("@")[0];
      const parsed = passwordSchema.safeParse(password);
      if (!parsed.success) return { error: "No account exists for that email yet: set a name and an initial password (10+ characters)" };
      user = await db.user.create({ data: { email, name, passwordHash: await hashPassword(parsed.data) } });
    }
    if (role === "EDITOR") {
      const existing = await ctx.db.lodgeMembership.findUnique({ where: { userId_lodgeId: { userId: user.id, lodgeId: ctx.lodge.id } } });
      if (existing?.role === "ADMIN" && (await ctx.db.lodgeMembership.count({ where: { role: "ADMIN" } })) <= 1) {
        return { error: "A lodge must keep at least one admin" };
      }
    }
    await ctx.db.lodgeMembership.upsert({
      where: { userId_lodgeId: { userId: user.id, lodgeId: ctx.lodge.id } },
      create: { userId: user.id, role },
      update: { role },
    });
    await audit(ctx, "member.added", { email, role });
    revalidatePath("/dashboard/members");
    return { ok: `${email} added as ${role.toLowerCase()}.` };
  } catch (err) {
    return fail(err);
  }
}

export async function removeMember(_prev: ActionResult, fd: FormData): Result {
  try {
    const ctx = await requireDashboard("ADMIN");
    const id = formString(fd, "id") ?? "";
    const target = await ctx.db.lodgeMembership.findUnique({ where: { id } });
    if (!target) return { error: "Member not found" };
    if (target.role === "ADMIN") {
      const admins = await ctx.db.lodgeMembership.count({ where: { role: "ADMIN" } });
      if (admins <= 1) return { error: "A lodge must keep at least one admin" };
    }
    await ctx.db.lodgeMembership.delete({ where: { id } });
    await audit(ctx, "member.removed", { userId: target.userId });
    revalidatePath("/dashboard/members");
    return { ok: "Member removed." };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Custom domains
// ---------------------------------------------------------------------------

export async function addDomain(_prev: ActionResult, fd: FormData): Result {
  try {
    const ctx = await requireDashboard("ADMIN");
    const domain = await addDomainService(ctx.lodge.id, formString(fd, "hostname") ?? "");
    await audit(ctx, "domain.added", { hostname: domain.hostname });
    revalidatePath("/dashboard/domain");
    return { ok: `Added ${domain.hostname}. Create the DNS records below; we check every minute.` };
  } catch (err) {
    return fail(err);
  }
}

export async function removeDomain(_prev: ActionResult, fd: FormData): Result {
  try {
    const ctx = await requireDashboard("ADMIN");
    const hostname = normalizeHostname(formString(fd, "hostname") ?? "");
    await ctx.db.domain.deleteMany({ where: { hostname } });
    await audit(ctx, "domain.removed", { hostname });
    revalidatePath("/dashboard/domain");
    return { ok: `Removed ${hostname}.` };
  } catch (err) {
    return fail(err);
  }
}

export async function recheckDomain(_prev: ActionResult, fd: FormData): Result {
  try {
    const ctx = await requireDashboard("ADMIN");
    const hostname = normalizeHostname(formString(fd, "hostname") ?? "");
    const domain = await ctx.db.domain.findFirst({ where: { hostname } });
    if (!domain) return { error: "Domain not found" };
    const updated = await checkDomain(domain);
    revalidatePath("/dashboard/domain");
    return updated.status === "VERIFIED" ? { ok: `${hostname} is verified.` } : { error: updated.lastError ?? "Not verified yet" };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export async function startCheckout(): Promise<void> {
  const ctx = await requireDashboard("ADMIN");
  if (canUseCustomDomain(ctx.lodge)) redirect("/dashboard/billing?already=1");
  const url = await createCheckoutSession({
    lodgeId: ctx.lodge.id,
    email: ctx.user.email,
    successUrl: lodgeSubdomainUrl(ctx.lodge.slug, "/dashboard/billing?checkout=success"),
    cancelUrl: lodgeSubdomainUrl(ctx.lodge.slug, "/dashboard/billing?checkout=cancelled"),
  });
  await audit(ctx, "billing.checkout_started");
  redirect(url);
}

export async function openBillingPortal(): Promise<void> {
  const ctx = await requireDashboard("ADMIN");
  const url = await createPortalSession(ctx.lodge.id, lodgeSubdomainUrl(ctx.lodge.slug, "/dashboard/billing"));
  redirect(url);
}
