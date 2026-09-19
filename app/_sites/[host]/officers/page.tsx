import { renderSitePage, siteMetadata } from "@/lib/site-render";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return siteMetadata("Officers");
}

export default async function SiteOfficers() {
  return renderSitePage({ kind: "officers" });
}
