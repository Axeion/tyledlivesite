import { renderSitePage, siteMetadata } from "@/lib/site-render";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return siteMetadata("Events");
}

export default async function SiteEvents() {
  return renderSitePage({ kind: "events" });
}
