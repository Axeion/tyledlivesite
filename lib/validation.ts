import { z } from "zod";
import { cleanMultiline, cleanText, sanitizeRichText, slugify } from "@/lib/sanitize";
import { isValidTimeZone } from "@/lib/events/timezone";

const text = (max: number) => z.string().max(max * 4).transform((s) => cleanText(s, max));
const optionalText = (max: number) => z.string().max(max * 4).optional().transform((s) => (s ? cleanText(s, max) : null));

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(10, "Password must be at least 10 characters").max(200);

export const lodgeInfoSchema = z.object({
  name: text(120).pipe(z.string().min(2, "Lodge name is required")),
  number: text(20).pipe(z.string().min(1, "Lodge number is required")),
  jurisdiction: text(120).pipe(z.string().min(2, "Jurisdiction is required")),
  tagline: optionalText(200),
  about: z.string().max(40_000).optional().transform((s) => (s ? sanitizeRichText(s) : null)),
  meetingSchedule: z.string().max(4000).optional().transform((s) => (s ? cleanMultiline(s, 1000) : null)),
  contactEmail: z.string().trim().max(254).optional().transform((s, ctx) => {
    if (!s) return null;
    const r = emailSchema.safeParse(s);
    if (!r.success) {
      ctx.addIssue({ code: "custom", message: "Contact email is invalid" });
      return z.NEVER;
    }
    return r.data;
  }),
  contactPhone: optionalText(40),
  website: z.string().trim().max(300).optional().transform((s, ctx) => {
    if (!s) return null;
    const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    try {
      const u = new URL(withScheme);
      if (!["http:", "https:"].includes(u.protocol)) throw new Error();
      return u.toString();
    } catch {
      ctx.addIssue({ code: "custom", message: "Website URL is invalid" });
      return z.NEVER;
    }
  }),
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(100),
  region: optionalText(100),
  postalCode: optionalText(20),
  country: z.string().trim().max(2).optional().transform((s) => (s ? s.toUpperCase().slice(0, 2) : "US")),
  timezone: z.string().max(64).optional().transform((s, ctx) => {
    const tz = s || "America/New_York";
    if (!isValidTimeZone(tz)) {
      ctx.addIssue({ code: "custom", message: "Unknown timezone" });
      return z.NEVER;
    }
    return tz;
  }),
});
export type LodgeInfoInput = z.infer<typeof lodgeInfoSchema>;

export const slugSchema = z
  .string()
  .max(80)
  .transform((s) => slugify(s))
  .pipe(z.string().min(3, "Subdomain must be at least 3 characters").max(60));

export const RESERVED_SLUGS = new Set([
  "www", "admin", "api", "app", "mail", "smtp", "ftp", "dashboard", "static", "assets", "cdn", "help", "support",
  "billing", "status", "blog", "docs", "login", "signup", "test", "staging", "dev",
  // Served by Caddy from MinIO, so it can never belong to a lodge.
  "files",
]);

export const officerSchema = z.object({
  title: text(80).pipe(z.string().min(1, "Title is required")),
  name: text(120).pipe(z.string().min(1, "Name is required")),
});

export const pageSchema = z.object({
  title: text(120).pipe(z.string().min(1, "Title is required")),
  slug: slugSchema,
  bodyHtml: z.string().max(60_000).transform((s) => sanitizeRichText(s)),
  published: z.boolean().default(true),
});

export const eventSchema = z.object({
  title: text(160).pipe(z.string().min(1, "Title is required")),
  description: z.string().max(8000).optional().transform((s) => (s ? cleanMultiline(s, 4000) : null)),
  location: optionalText(200),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional().nullable(),
  allDay: z.boolean().default(false),
  rrule: z.string().max(200).optional().transform((s) => (s ? s.trim() : null)),
  until: z.coerce.date().optional().nullable(),
});

export function formString(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return typeof v === "string" ? v : undefined;
}

export function formBool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

/** Flatten a zod error into a single readable line. */
export function zodMessage(err: z.ZodError): string {
  return err.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ");
}
