import { ActionButton, ActionForm } from "@/components/ActionForm";
import { deleteGalleryImage, uploadGalleryImage } from "@/lib/actions/lodge";
import { requireDashboard } from "@/lib/dashboard";
import { publicUrl } from "@/lib/storage";

export default async function GalleryPage() {
  const { db } = await requireDashboard("EDITOR", { redirect: true });
  const images = await db.galleryImage.findMany({ orderBy: { order: "asc" } });
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Gallery</h2>
      <ActionForm action={uploadGalleryImage} submitLabel="Upload photo" className="card grid gap-3 md:grid-cols-2" encType="multipart/form-data">
        <div>
          <label className="label" htmlFor="file">Photo (PNG, JPEG, WebP · max 5 MB)</label>
          <input id="file" type="file" name="file" accept="image/png,image/jpeg,image/webp" className="field" required data-testid="gallery-file" />
        </div>
        <div>
          <label className="label" htmlFor="caption">Caption</label>
          <input id="caption" name="caption" className="field" maxLength={200} />
        </div>
      </ActionForm>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3" data-testid="gallery-grid">
        {images.map((img) => (
          <li key={img.id} className="card p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={publicUrl(img.key)!} alt={img.caption ?? ""} className="aspect-[4/3] w-full rounded object-cover" />
            <p className="mt-2 text-sm">{img.caption}</p>
            <ActionButton action={deleteGalleryImage} label="Delete" className="mt-1 text-sm text-red-700 underline" hidden={{ id: img.id }} confirm="Delete this photo?" />
          </li>
        ))}
      </ul>
    </div>
  );
}
