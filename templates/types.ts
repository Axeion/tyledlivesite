import type { Occurrence } from "@/lib/events/recurrence";
import type { ComponentType } from "react";

/**
 * The single content schema every template renders. Switching templates only
 * changes which component receives this object, so no data is ever lost.
 */
export interface LodgeSiteData {
  lodge: {
    slug: string;
    name: string;
    number: string;
    jurisdiction: string;
    tagline: string | null;
    aboutHtml: string; // already sanitized
    meetingSchedule: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    website: string | null;
    timezone: string;
    address: {
      line1: string | null;
      line2: string | null;
      city: string | null;
      region: string | null;
      postalCode: string | null;
      country: string | null;
      formatted: string;
    };
    lat: number | null;
    lng: number | null;
    logoUrl: string | null;
    sealUrl: string | null;
  };
  officers: { id: string; title: string; name: string }[];
  gallery: { id: string; url: string; caption: string | null }[];
  pages: { id: string; slug: string; title: string; bodyHtml: string }[];
  upcomingEvents: Occurrence[];
  /** URLs relative to the site root. */
  links: {
    home: string;
    events: string;
    calendar: string;
    officers: string;
    gallery: string;
    contact: string;
    ical: string;
    page: (slug: string) => string;
  };
  /** True when rendered inside the dashboard preview (shows a banner). */
  preview: boolean;
  /** True when rendered small and non-interactive, as a template thumbnail. */
  thumbnail?: boolean;
}

export type SitePage =
  | { kind: "home" }
  | { kind: "events" }
  | { kind: "calendar"; year: number; month: number; occurrences: Occurrence[] }
  | { kind: "officers" }
  | { kind: "gallery" }
  | { kind: "contact" }
  | { kind: "page"; slug: string };

export interface TemplateProps {
  data: LodgeSiteData;
  page: SitePage;
}

export type TemplateTier = "free" | "premium";

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  tier: TemplateTier;
  /** Small swatch colours for the picker UI. */
  swatch: [string, string, string];
  Component: ComponentType<TemplateProps>;
}
