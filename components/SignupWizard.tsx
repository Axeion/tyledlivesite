"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { checkSlugAvailability, redirectAfterSignup, submitSignup } from "@/lib/actions/signup";
import { slugify } from "@/lib/sanitize";
import type { SignupInput } from "@/lib/signup-schema";
import { getTemplate } from "@/templates/registry";
import type { LodgeSiteData } from "@/templates/types";

interface TemplateOption {
  id: string;
  name: string;
  description: string;
  tier: "free" | "premium";
  swatch: [string, string, string];
}

const STEPS = ["Account", "Template", "Lodge details", "Preview", "Submit"] as const;

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage",
  "Pacific/Honolulu", "America/Toronto", "America/Vancouver", "Europe/London", "Europe/Dublin", "Australia/Sydney",
];

const empty: SignupInput = {
  account: { name: "", email: "", password: "" },
  templateId: "classic",
  slug: "",
  lodge: {
    name: "",
    number: "",
    jurisdiction: "",
    tagline: "",
    about: "",
    meetingSchedule: "",
    contactEmail: "",
    contactPhone: "",
    website: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    region: "",
    postalCode: "",
    country: "US",
    timezone: "America/New_York",
  },
};

export function SignupWizard({ templates, platformDomain }: { templates: TemplateOption[]; platformDomain: string }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<SignupInput>(empty);
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<{ available: boolean; reason?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The subdomain is derived from the lodge name/number until the user edits it.
  const setLodge = (patch: Partial<SignupInput["lodge"]>) =>
    setForm((f) => {
      const lodge = { ...f.lodge, ...patch };
      const slug = slugTouched ? f.slug : slugify(`${lodge.name} ${lodge.number}`.trim());
      return { ...f, lodge, slug };
    });
  const setAccount = (patch: Partial<SignupInput["account"]>) => setForm((f) => ({ ...f, account: { ...f.account, ...patch } }));

  useEffect(() => {
    const slug = form.slug;
    const t = setTimeout(() => {
      if (!slug) return setSlugStatus(null);
      checkSlugAvailability(slug).then((r) => setSlugStatus({ available: r.available, reason: r.reason })).catch(() => undefined);
    }, 300);
    return () => clearTimeout(t);
  }, [form.slug]);

  const previewData = useMemo<LodgeSiteData>(() => {
    const l = form.lodge;
    return {
      lodge: {
        slug: form.slug,
        name: l.name || "Your Lodge",
        number: l.number || "0",
        jurisdiction: l.jurisdiction || "Your Grand Lodge",
        tagline: l.tagline || null,
        aboutHtml: l.about || "",
        meetingSchedule: l.meetingSchedule || null,
        contactEmail: l.contactEmail || null,
        contactPhone: l.contactPhone || null,
        website: l.website || null,
        timezone: l.timezone || "America/New_York",
        address: {
          line1: l.addressLine1 || null,
          line2: l.addressLine2 || null,
          city: l.city || null,
          region: l.region || null,
          postalCode: l.postalCode || null,
          country: l.country || null,
          formatted: [l.addressLine1, l.city, l.region, l.postalCode].filter(Boolean).join(", "),
        },
        lat: null,
        lng: null,
        logoUrl: null,
        sealUrl: null,
      },
      officers: [
        { id: "1", title: "Worshipful Master", name: "Your Master" },
        { id: "2", title: "Secretary", name: "Your Secretary" },
      ],
      gallery: [],
      pages: [],
      upcomingEvents: [],
      links: { home: "#", events: "#", calendar: "#", officers: "#", gallery: "#", contact: "#", ical: "#", page: () => "#" },
      preview: true,
    };
  }, [form]);

  const validateStep = (): string | null => {
    if (step === 0) {
      if (!form.account.name.trim()) return "Your name is required";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.account.email)) return "Enter a valid email address";
      if (form.account.password.length < 10) return "Password must be at least 10 characters";
    }
    if (step === 2) {
      if (!form.lodge.name.trim()) return "Lodge name is required";
      if (!form.lodge.number.trim()) return "Lodge number is required";
      if (!form.lodge.jurisdiction.trim()) return "Jurisdiction is required";
      if (!form.slug) return "Choose a subdomain";
      if (slugStatus && !slugStatus.available) return `Subdomain unavailable: ${slugStatus.reason ?? ""}`;
    }
    return null;
  };

  const next = () => {
    const err = validateStep();
    setError(err);
    if (!err) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await submitSignup(form);
      if (!res.ok || !res.redirectTo) {
        setError(res.error ?? "Something went wrong");
        return;
      }
      await redirectAfterSignup(res.redirectTo);
    });
  };

  const Template = getTemplate(form.templateId).Component;

  return (
    <div className="mt-8">
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`rounded-full px-3 py-1 ${i === step ? "bg-indigo-600 text-white" : i < step ? "bg-indigo-100 text-indigo-800" : "bg-neutral-100 text-neutral-500"}`}
            aria-current={i === step ? "step" : undefined}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      <div className="card mt-6" data-testid={`signup-step-${step}`}>
        {step === 0 ? (
          <div className="grid gap-4 md:max-w-md">
            <h2 className="text-lg font-semibold">Your account</h2>
            <div>
              <label className="label" htmlFor="acct-name">Your name</label>
              <input id="acct-name" className="field" value={form.account.name} onChange={(e) => setAccount({ name: e.target.value })} autoComplete="name" />
            </div>
            <div>
              <label className="label" htmlFor="acct-email">Email</label>
              <input id="acct-email" type="email" className="field" value={form.account.email} onChange={(e) => setAccount({ email: e.target.value })} autoComplete="email" />
            </div>
            <div>
              <label className="label" htmlFor="acct-password">Password (10+ characters)</label>
              <input id="acct-password" type="password" className="field" value={form.account.password} onChange={(e) => setAccount({ password: e.target.value })} autoComplete="new-password" />
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div>
            <h2 className="text-lg font-semibold">Pick a template</h2>
            <p className="text-sm text-neutral-600">You can switch later without losing anything.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {templates.map((t) => {
                const locked = t.tier === "premium";
                const selected = form.templateId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={locked}
                    onClick={() => setForm((f) => ({ ...f, templateId: t.id }))}
                    className={`rounded-lg border p-4 text-left transition ${selected ? "border-indigo-600 ring-2 ring-indigo-200" : "border-neutral-200 hover:border-neutral-400"} ${locked ? "cursor-not-allowed opacity-50" : ""}`}
                    data-testid={`template-${t.id}`}
                    aria-pressed={selected}
                  >
                    <div className="mb-3 flex gap-1">
                      {t.swatch.map((c) => (
                        <span key={c} className="h-6 flex-1 rounded" style={{ background: c }} />
                      ))}
                    </div>
                    <div className="font-semibold">
                      {t.name} {locked ? <span className="ml-1 rounded bg-amber-100 px-1.5 text-xs text-amber-800">Premium</span> : null}
                    </div>
                    <p className="mt-1 text-sm text-neutral-600">{t.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <h2 className="text-lg font-semibold md:col-span-2">Lodge details</h2>
            <Field label="Lodge name" id="lodge-name" value={form.lodge.name} onChange={(v) => setLodge({ name: v })} />
            <Field label="Lodge number" id="lodge-number" value={form.lodge.number} onChange={(v) => setLodge({ number: v })} />
            <Field label="Grand Lodge / jurisdiction" id="lodge-jurisdiction" value={form.lodge.jurisdiction} onChange={(v) => setLodge({ jurisdiction: v })} />
            <div>
              <label className="label" htmlFor="lodge-slug">Subdomain</label>
              <div className="flex items-center gap-1">
                <input
                  id="lodge-slug"
                  className="field"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
                  }}
                />
                <span className="whitespace-nowrap text-sm text-neutral-500">.{platformDomain}</span>
              </div>
              {slugStatus ? (
                <p className={`mt-1 text-xs ${slugStatus.available ? "text-green-700" : "text-red-700"}`} data-testid="slug-status">
                  {slugStatus.available ? "Available" : slugStatus.reason ?? "Unavailable"}
                </p>
              ) : null}
            </div>
            <Field label="Tagline" id="lodge-tagline" value={form.lodge.tagline ?? ""} onChange={(v) => setLodge({ tagline: v })} />
            <div>
              <label className="label" htmlFor="lodge-tz">Timezone</label>
              <select id="lodge-tz" className="field" value={form.lodge.timezone ?? "America/New_York"} onChange={(e) => setLodge({ timezone: e.target.value })}>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="lodge-schedule">Meeting schedule</label>
              <textarea id="lodge-schedule" className="field" rows={2} value={form.lodge.meetingSchedule ?? ""} onChange={(e) => setLodge({ meetingSchedule: e.target.value })} placeholder="Stated communication: 2nd Tuesday monthly, 7:30 PM" />
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="lodge-about">About the lodge</label>
              <textarea id="lodge-about" className="field" rows={4} value={form.lodge.about ?? ""} onChange={(e) => setLodge({ about: e.target.value })} placeholder="A few sentences about your lodge. Basic HTML is allowed." />
            </div>
            <Field label="Contact email" id="lodge-email" type="email" value={form.lodge.contactEmail ?? ""} onChange={(v) => setLodge({ contactEmail: v })} />
            <Field label="Contact phone" id="lodge-phone" value={form.lodge.contactPhone ?? ""} onChange={(v) => setLodge({ contactPhone: v })} />
            <Field label="Address line 1" id="lodge-addr1" value={form.lodge.addressLine1 ?? ""} onChange={(v) => setLodge({ addressLine1: v })} />
            <Field label="Address line 2" id="lodge-addr2" value={form.lodge.addressLine2 ?? ""} onChange={(v) => setLodge({ addressLine2: v })} />
            <Field label="City" id="lodge-city" value={form.lodge.city ?? ""} onChange={(v) => setLodge({ city: v })} />
            <Field label="State / region" id="lodge-region" value={form.lodge.region ?? ""} onChange={(v) => setLodge({ region: v })} />
            <Field label="Postal code" id="lodge-postal" value={form.lodge.postalCode ?? ""} onChange={(v) => setLodge({ postalCode: v })} />
            <Field label="Country (2-letter)" id="lodge-country" value={form.lodge.country ?? "US"} onChange={(v) => setLodge({ country: v })} />
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <h2 className="text-lg font-semibold">Preview</h2>
            <p className="mb-4 text-sm text-neutral-600">This is a preview of your home page using the {getTemplate(form.templateId).name} template.</p>
            <div className="max-h-[70vh] overflow-auto rounded-lg border border-neutral-200" data-testid="signup-preview">
              <Template data={previewData} page={{ kind: "home" }} />
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="max-w-xl">
            <h2 className="text-lg font-semibold">Submit for review</h2>
            <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
              <dt className="text-neutral-500">Lodge</dt>
              <dd>{form.lodge.name} No. {form.lodge.number}, {form.lodge.jurisdiction}</dd>
              <dt className="text-neutral-500">Site address</dt>
              <dd>{form.slug}.{platformDomain}</dd>
              <dt className="text-neutral-500">Template</dt>
              <dd>{getTemplate(form.templateId).name}</dd>
              <dt className="text-neutral-500">Admin</dt>
              <dd>{form.account.name} ({form.account.email})</dd>
            </dl>
            <p className="mt-4 text-sm text-neutral-600">
              After you submit, the platform team verifies that your lodge is real. Until then your site shows a
              &ldquo;coming soon&rdquo; page, but you can keep editing everything from your dashboard.
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="alert-error mt-4" role="alert" data-testid="signup-error">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-between">
          <button type="button" className="btn-secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || pending}>
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn-primary" onClick={next} data-testid="signup-next">
              Continue
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={submit} disabled={pending} data-testid="signup-submit">
              {pending ? "Submitting…" : "Submit for review"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, id, value, onChange, type = "text" }: { label: string; id: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input id={id} type={type} className="field" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
