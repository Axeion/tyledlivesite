import { renderSitePage, siteMetadata } from "@/lib/site-render";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return siteMetadata();
}

export default async function SiteHome() {
  return renderSitePage({ kind: "home" });
}
