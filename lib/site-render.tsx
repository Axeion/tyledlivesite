import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { buildSiteData } from "@/lib/site-data";
import { getCurrentTenant, isSiteLive } from "@/lib/tenant";
import { getTemplate } from "@/templates/registry";
import type { SitePage } from "@/templates/types";
import type { Lodge } from "@/generated/prisma/client";

/** Resolve the lodge for this request's host or bail with 404/redirect. */
export async function requireSiteLodge(): Promise<Lodge> {
  const tenant = await getCurrentTenant();
  if (tenant.kind === "fallback") redirect(tenant.redirectTo);
  if (tenant.kind !== "lodge") notFound();
  return tenant.lodge;
}

export function ComingSoon({ lodge }: { lodge: Lodge }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-neutral-50 p-8 text-center" data-testid="coming-soon">
      <p className="text-sm uppercase tracking-widest text-neutral-500">Coming soon</p>
      <h1 className="text-3xl font-semibold">
        {lodge.name} No. {lodge.number}
      </h1>
      <p className="max-w-md text-neutral-600">
        This lodge&apos;s website is not published yet. Please check back shortly.
      </p>
    </main>
  );
}

/** Render a public site page for the current tenant. */
export async function renderSitePage(page: SitePage) {
  const lodge = await requireSiteLodge();
  if (!isSiteLive(lodge)) return <ComingSoon lodge={lodge} />;
  const data = await buildSiteData(lodge);
  if (page.kind === "page" && !data.pages.some((p) => p.slug === page.slug)) notFound();
  const template = getTemplate(lodge.templateId);
  return <template.Component data={data} page={page} />;
}

export async function siteMetadata(title?: string): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  if (tenant.kind !== "lodge") return {};
  const base = `${tenant.lodge.name} No. ${tenant.lodge.number}`;
  return {
    title: title ? `${title} · ${base}` : base,
    description: tenant.lodge.tagline ?? `${base}, ${tenant.lodge.jurisdiction}`,
  };
}
