import { expandEvents } from "@/lib/events/recurrence";
import { formatAddress } from "@/lib/geocode";
import { publicUrl } from "@/lib/storage";
import { tenantDb } from "@/lib/tenant-db";
import type { Lodge } from "@/generated/prisma/client";
import type { LodgeSiteData } from "@/templates/types";

export interface BuildSiteDataOptions {
  preview?: boolean;
  now?: Date;
  /** Base path for links (dashboard preview mounts the site under /dashboard/preview). */
  basePath?: string;
}

/** Assemble everything a template needs, scoped strictly to this lodge. */
export async function buildSiteData(lodge: Lodge, opts: BuildSiteDataOptions = {}): Promise<LodgeSiteData> {
  const db = tenantDb(lodge.id);
  const now = opts.now ?? new Date();
  const base = opts.basePath ?? "";
  const [officers, gallery, pages, events] = await Promise.all([
    db.officer.findMany({ orderBy: { order: "asc" } }),
    db.galleryImage.findMany({ orderBy: { order: "asc" } }),
    db.page.findMany({ where: { published: true }, orderBy: { order: "asc" } }),
    db.event.findMany({ orderBy: { startsAt: "asc" } }),
  ]);
  const horizon = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
  const upcomingEvents = expandEvents(events, now, horizon, lodge.timezone).slice(0, 50);

  return {
    lodge: {
      slug: lodge.slug,
      name: lodge.name,
      number: lodge.number,
      jurisdiction: lodge.jurisdiction,
      tagline: lodge.tagline,
      aboutHtml: lodge.about ?? "",
      meetingSchedule: lodge.meetingSchedule,
      contactEmail: lodge.contactEmail,
      contactPhone: lodge.contactPhone,
      website: lodge.website,
      timezone: lodge.timezone,
      address: {
        line1: lodge.addressLine1,
        line2: lodge.addressLine2,
        city: lodge.city,
        region: lodge.region,
        postalCode: lodge.postalCode,
        country: lodge.country,
        formatted: formatAddress(lodge),
      },
      lat: lodge.lat,
      lng: lodge.lng,
      logoUrl: publicUrl(lodge.logoKey),
      sealUrl: publicUrl(lodge.sealKey),
    },
    officers: officers.map((o) => ({ id: o.id, title: o.title, name: o.name })),
    gallery: gallery.map((g) => ({ id: g.id, url: publicUrl(g.key)!, caption: g.caption })),
    pages: pages.map((p) => ({ id: p.id, slug: p.slug, title: p.title, bodyHtml: p.bodyHtml })),
    upcomingEvents,
    links: {
      home: `${base}/`,
      events: `${base}/events`,
      calendar: `${base}/events/calendar`,
      officers: `${base}/officers`,
      gallery: `${base}/gallery`,
      contact: `${base}/contact`,
      ical: `${base}/calendar.ics`,
      page: (slug: string) => `${base}/p/${slug}`,
    },
    preview: opts.preview ?? false,
  };
}
