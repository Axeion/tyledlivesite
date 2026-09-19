import ClassicTemplate from "@/templates/classic";
import ModernTemplate from "@/templates/modern";
import MinimalTemplate from "@/templates/minimal";
import type { TemplateDefinition } from "@/templates/types";

/**
 * Every available template. All three current themes are free. Premium
 * templates (phase 2) get `tier: "premium"` and are gated by
 * lib/entitlements.ts#canUseTemplate.
 */
export const TEMPLATES: readonly TemplateDefinition[] = [
  {
    id: "classic",
    name: "Classic",
    description: "Navy and gold with serif headings. A traditional look for established lodges.",
    tier: "free",
    swatch: ["#0b1f3a", "#c9a227", "#f7f5ef"],
    Component: ClassicTemplate,
  },
  {
    id: "modern",
    name: "Modern",
    description: "Bold hero, card layout and a sticky navigation bar.",
    tier: "free",
    swatch: ["#0f172a", "#6366f1", "#f8fafc"],
    Component: ModernTemplate,
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "A single quiet column. Lets your words and photos speak.",
    tier: "free",
    swatch: ["#171717", "#a3a3a3", "#ffffff"],
    Component: MinimalTemplate,
  },
];

export const DEFAULT_TEMPLATE_ID = "classic";

export function getTemplate(id: string | null | undefined): TemplateDefinition {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID)!;
}

export function isTemplateId(id: string): boolean {
  return TEMPLATES.some((t) => t.id === id);
}
