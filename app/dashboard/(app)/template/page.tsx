import { ActionButton } from "@/components/ActionForm";
import { setTemplate } from "@/lib/actions/lodge";
import { requireDashboard } from "@/lib/dashboard";
import { canUseTemplate } from "@/lib/entitlements";
import { TEMPLATES } from "@/templates/registry";

export default async function TemplatePage() {
  const { lodge } = await requireDashboard("ADMIN", { redirect: true });
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Template</h2>
      <p className="text-sm text-neutral-600">
        All templates share the same content, so switching never loses officers, events, pages or photos.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {TEMPLATES.map((t) => {
          const current = lodge.templateId === t.id;
          const allowed = canUseTemplate(lodge, t);
          return (
            <div key={t.id} className={`card ${current ? "border-indigo-500 ring-2 ring-indigo-100" : ""}`} data-testid={`template-card-${t.id}`}>
              <div className="mb-3 flex gap-1">
                {t.swatch.map((c) => (
                  <span key={c} className="h-8 flex-1 rounded" style={{ background: c }} />
                ))}
              </div>
              <h3 className="font-semibold">
                {t.name} <span className="ml-1 text-xs font-normal uppercase text-neutral-500">{t.tier}</span>
              </h3>
              <p className="mt-1 text-sm text-neutral-600">{t.description}</p>
              <div className="mt-4">
                {current ? (
                  <span className="text-sm font-medium text-indigo-700" data-testid="template-current">
                    Current template
                  </span>
                ) : allowed ? (
                  <ActionButton action={setTemplate} label={`Use ${t.name}`} className="btn-primary" hidden={{ templateId: t.id }} />
                ) : (
                  <span className="text-sm text-neutral-500">Requires the paid plan</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
