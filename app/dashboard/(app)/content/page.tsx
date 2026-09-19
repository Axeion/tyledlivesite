import { ActionButton, ActionForm } from "@/components/ActionForm";
import { removeLodgeImage, updateLodgeInfo, uploadLodgeImage } from "@/lib/actions/lodge";
import { requireDashboard } from "@/lib/dashboard";
import { publicUrl } from "@/lib/storage";

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage",
  "Pacific/Honolulu", "America/Toronto", "America/Vancouver", "Europe/London", "Europe/Dublin", "Australia/Sydney",
];

export default async function ContentPage() {
  const { lodge } = await requireDashboard("EDITOR", { redirect: true });
  const tzOptions = TIMEZONES.includes(lodge.timezone) ? TIMEZONES : [lodge.timezone, ...TIMEZONES];
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Lodge information</h2>
      <ActionForm action={updateLodgeInfo} className="card grid gap-4 md:grid-cols-2" submitLabel="Save changes">
        <Input label="Lodge name" name="name" defaultValue={lodge.name} required />
        <Input label="Lodge number" name="number" defaultValue={lodge.number} required />
        <Input label="Grand Lodge / jurisdiction" name="jurisdiction" defaultValue={lodge.jurisdiction} required />
        <Input label="Tagline" name="tagline" defaultValue={lodge.tagline ?? ""} />
        <div>
          <label className="label" htmlFor="timezone">Timezone</label>
          <select id="timezone" name="timezone" className="field" defaultValue={lodge.timezone}>
            {tzOptions.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
        <Input label="Website" name="website" defaultValue={lodge.website ?? ""} />
        <div className="md:col-span-2">
          <label className="label" htmlFor="meetingSchedule">Meeting schedule</label>
          <textarea id="meetingSchedule" name="meetingSchedule" rows={2} className="field" defaultValue={lodge.meetingSchedule ?? ""} />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="about">About (basic HTML allowed: p, h2, h3, ul, ol, a, strong, em, img)</label>
          <textarea id="about" name="about" rows={8} className="field font-mono text-xs" defaultValue={lodge.about ?? ""} />
        </div>
        <Input label="Contact email" name="contactEmail" type="email" defaultValue={lodge.contactEmail ?? ""} />
        <Input label="Contact phone" name="contactPhone" defaultValue={lodge.contactPhone ?? ""} />
        <Input label="Address line 1" name="addressLine1" defaultValue={lodge.addressLine1 ?? ""} />
        <Input label="Address line 2" name="addressLine2" defaultValue={lodge.addressLine2 ?? ""} />
        <Input label="City" name="city" defaultValue={lodge.city ?? ""} />
        <Input label="State / region" name="region" defaultValue={lodge.region ?? ""} />
        <Input label="Postal code" name="postalCode" defaultValue={lodge.postalCode ?? ""} />
        <Input label="Country (2-letter)" name="country" defaultValue={lodge.country ?? "US"} />
        <p className="text-sm text-neutral-500 md:col-span-2">
          Map location: {lodge.lat !== null && lodge.lng !== null ? `${lodge.lat.toFixed(4)}, ${lodge.lng.toFixed(4)}` : "not located yet (updated automatically within a minute of saving an address)"}
        </p>
      </ActionForm>

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
                  <ActionButton action={removeLodgeImage} label="Remove" hidden={{ kind }} />
                </div>
              ) : null}
              <ActionForm action={uploadLodgeImage} submitLabel="Upload" className="mt-3" encType="multipart/form-data">
                <input type="hidden" name="kind" value={kind} />
                <input type="file" name="file" accept="image/png,image/jpeg,image/webp" className="field" data-testid={`${kind}-file`} />
              </ActionForm>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Input({ label, name, defaultValue, type = "text", required }: { label: string; name: string; defaultValue: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} type={type} defaultValue={defaultValue} className="field" required={required} />
    </div>
  );
}
