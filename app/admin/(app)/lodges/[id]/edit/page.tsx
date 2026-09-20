import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { LodgeImages } from "@/components/LodgeImages";
import { LodgeInfoFields } from "@/components/LodgeInfoFields";
import { TemplatePicker } from "@/components/TemplatePicker";
import { adminRemoveLodgeImage, adminSetTemplate, adminUpdateLodgeInfo, adminUploadLodgeImage } from "@/lib/actions/admin";
import { db } from "@/lib/db";
import { lodgeSubdomainUrl } from "@/lib/urls";

/**
 * Everything a lodge can change about its own site, editable by the platform
 * admin on the lodge's behalf. Same fields and validation as the dashboard;
 * every save is audited as done by the platform admin.
 */
export default async function AdminLodgeEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lodge = await db.lodge.findUnique({ where: { id } });
  if (!lodge) notFound();
  const hidden = { lodgeId: lodge.id };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm">
          <Link href={`/admin/lodges/${lodge.id}`} className="text-indigo-600 underline">
            ← {lodge.name} No. {lodge.number}
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-bold">Edit site</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Changes go live immediately at{" "}
          <a className="text-indigo-600 underline" href={lodgeSubdomainUrl(lodge.slug)} target="_blank" rel="noreferrer">
            {lodgeSubdomainUrl(lodge.slug)}
          </a>{" "}
          and are recorded in the lodge&apos;s activity as made by the platform admin.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Lodge information</h2>
        <ActionForm action={adminUpdateLodgeInfo} className="card grid gap-4 md:grid-cols-2" submitLabel="Save changes" data-testid="admin-lodge-info">
          <input type="hidden" name="lodgeId" value={lodge.id} />
          <LodgeInfoFields lodge={lodge} />
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Logo and seal</h2>
        <LodgeImages lodge={lodge} upload={adminUploadLodgeImage} remove={adminRemoveLodgeImage} hidden={hidden} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Template</h2>
        <p className="text-sm text-neutral-600">
          All templates share the same content, so switching never loses officers, events, pages or photos.
        </p>
        <TemplatePicker lodge={lodge} action={adminSetTemplate} hidden={hidden} allowAbovePlan />
      </section>
    </div>
  );
}
