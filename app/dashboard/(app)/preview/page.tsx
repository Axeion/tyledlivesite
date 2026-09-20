import Link from "next/link";
import { requireDashboard } from "@/lib/dashboard";
import { buildSiteData } from "@/lib/site-data";
import { getTemplate } from "@/templates/registry";
import type { SitePage } from "@/templates/types";

const PAGES: { key: string; label: string; page: SitePage }[] = [
  { key: "home", label: "Home", page: { kind: "home" } },
  { key: "events", label: "Events", page: { kind: "events" } },
  { key: "officers", label: "Officers", page: { kind: "officers" } },
  { key: "gallery", label: "Gallery", page: { kind: "gallery" } },
  { key: "contact", label: "Contact", page: { kind: "contact" } },
];

/** Renders the site exactly as visitors will see it, even while unpublished. */
export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { lodge } = await requireDashboard("EDITOR", { redirect: true });
  const { page } = await searchParams;
  const selected = PAGES.find((p) => p.key === page) ?? PAGES[0];
  const data = await buildSiteData(lodge, { preview: true, basePath: "/dashboard/preview" });
  // Links inside the preview should keep the user in preview mode.
  data.links = {
    home: "/dashboard/preview",
    events: "/dashboard/preview?page=events",
    calendar: "/dashboard/preview?page=events",
    officers: "/dashboard/preview?page=officers",
    gallery: "/dashboard/preview?page=gallery",
    contact: "/dashboard/preview?page=contact",
    ical: "/calendar.ics",
    page: () => "/dashboard/preview",
  };
  const template = getTemplate(lodge.templateId);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Preview:</span>
        {PAGES.map((p) => (
          <Link key={p.key} href={`/dashboard/preview?page=${p.key}`} className={`rounded px-2 py-1 ${p.key === selected.key ? "bg-indigo-600 text-white" : "bg-white dark:bg-neutral-800"}`}>
            {p.label}
          </Link>
        ))}
        <span className="text-neutral-500 dark:text-neutral-400">· template {template.name}</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900" data-testid="preview-frame">
        <template.Component data={data} page={selected.page} />
      </div>
    </div>
  );
}
