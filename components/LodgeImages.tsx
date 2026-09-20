import { ActionButton, ActionForm, type FormAction } from "@/components/ActionForm";
import { publicUrl } from "@/lib/storage";
import type { Lodge } from "@/generated/prisma/client";

/**
 * Logo and seal upload/remove panels. `hidden` is merged into every submit so
 * the platform admin can name the lodge it is acting on.
 */
export function LodgeImages({
  lodge,
  upload,
  remove,
  hidden = {},
}: {
  lodge: Lodge;
  upload: FormAction;
  remove: FormAction;
  hidden?: Record<string, string>;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {(["logo", "seal"] as const).map((kind) => {
        const key = kind === "logo" ? lodge.logoKey : lodge.sealKey;
        return (
          <section key={kind} className="card">
            <h3 className="font-semibold capitalize">{kind}</h3>
            <p className="text-sm text-neutral-500">PNG, JPEG or WebP, up to 5 MB.</p>
            {key ? (
              <div className="mt-3 flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={publicUrl(key)!} alt={`${lodge.name} ${kind}`} className="h-24 w-24 rounded bg-neutral-100 object-contain" data-testid={`${kind}-image`} />
                <ActionButton action={remove} label="Remove" hidden={{ ...hidden, kind }} />
              </div>
            ) : null}
            <ActionForm action={upload} submitLabel="Upload" className="mt-3" encType="multipart/form-data">
              {Object.entries(hidden).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <input type="hidden" name="kind" value={kind} />
              <input type="file" name="file" accept="image/png,image/jpeg,image/webp" className="field" data-testid={`${kind}-file`} />
            </ActionForm>
          </section>
        );
      })}
    </div>
  );
}
