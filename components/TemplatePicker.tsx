import { ActionButton, type FormAction } from "@/components/ActionForm";
import { canUseTemplate } from "@/lib/entitlements";
import { TEMPLATES } from "@/templates/registry";
import type { Lodge } from "@/generated/prisma/client";

/**
 * Template cards with a "use this" button on each. Lodge admins are held to
 * their plan; the platform admin passes `allowAbovePlan` and instead sees a
 * note on any template the lodge could not pick for itself.
 */
export function TemplatePicker({
  lodge,
  action,
  hidden = {},
  allowAbovePlan = false,
}: {
  lodge: Lodge;
  action: FormAction;
  hidden?: Record<string, string>;
  allowAbovePlan?: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {TEMPLATES.map((t) => {
        const current = lodge.templateId === t.id;
        const withinPlan = canUseTemplate(lodge, t);
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
              ) : withinPlan || allowAbovePlan ? (
                <>
                  <ActionButton action={action} label={`Use ${t.name}`} className="btn-primary" hidden={{ ...hidden, templateId: t.id }} />
                  {!withinPlan ? <p className="mt-2 text-xs text-amber-700">Above this lodge&apos;s plan; setting it here overrides that.</p> : null}
                </>
              ) : (
                <span className="text-sm text-neutral-500">Requires the paid plan</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
