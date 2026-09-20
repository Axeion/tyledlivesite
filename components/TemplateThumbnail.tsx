import { getTemplate } from "@/templates/registry";
import type { LodgeSiteData } from "@/templates/types";

/**
 * A live thumbnail of a template, rendered with the lodge's own content.
 *
 * The template is rendered at a desktop width and scaled down, so each theme's
 * real layout is what you see — three colour swatches never told a secretary
 * what they were choosing. The frame is sized to exactly the scaled render so
 * nothing is clipped and no dead space is left beside it. The whole thing is
 * inert: no clicks, no focus stops, and no live map (see ContactBlock).
 */
const WIDTH = 1024;
const HEIGHT = 768;
const SCALE = 0.24;

export function TemplateThumbnail({ data, templateId }: { data: LodgeSiteData; templateId: string }) {
  const template = getTemplate(templateId);
  const thumbData: LodgeSiteData = { ...data, thumbnail: true, preview: false };
  return (
    <div
      className="mx-auto max-w-full overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
      style={{ width: Math.round(WIDTH * SCALE), height: Math.round(HEIGHT * SCALE) }}
      data-testid={`template-thumb-${templateId}`}
      aria-hidden="true"
      inert
    >
      <div
        className="overflow-hidden"
        style={{ width: WIDTH, height: HEIGHT, transform: `scale(${SCALE})`, transformOrigin: "top left" }}
      >
        <template.Component data={thumbData} page={{ kind: "home" }} />
      </div>
    </div>
  );
}
