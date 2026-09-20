import { ActionForm } from "@/components/ActionForm";
import { LodgeImages } from "@/components/LodgeImages";
import { LodgeInfoFields } from "@/components/LodgeInfoFields";
import { removeLodgeImage, updateLodgeInfo, uploadLodgeImage } from "@/lib/actions/lodge";
import { requireDashboard } from "@/lib/dashboard";

export default async function ContentPage() {
  const { lodge } = await requireDashboard("EDITOR", { redirect: true });
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Lodge information</h2>
      <ActionForm action={updateLodgeInfo} className="card grid gap-4 md:grid-cols-2" submitLabel="Save changes">
        <LodgeInfoFields lodge={lodge} />
      </ActionForm>
      <LodgeImages lodge={lodge} upload={uploadLodgeImage} remove={removeLodgeImage} />
    </div>
  );
}
