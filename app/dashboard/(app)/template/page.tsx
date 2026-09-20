import { TemplatePicker } from "@/components/TemplatePicker";
import { setTemplate } from "@/lib/actions/lodge";
import { requireDashboard } from "@/lib/dashboard";
import { buildSiteData } from "@/lib/site-data";

export default async function TemplatePage() {
  const { lodge } = await requireDashboard("ADMIN", { redirect: true });
  // One fetch, rendered once per template, so each card previews real content.
  const data = await buildSiteData(lodge);
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Template</h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Each card shows your own site in that theme. All templates share the same content, so switching never loses
        officers, events, pages or photos.
      </p>
      <TemplatePicker lodge={lodge} action={setTemplate} data={data} />
    </div>
  );
}
