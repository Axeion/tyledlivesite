import { renderSitePage, siteMetadata } from "@/lib/site-render";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return siteMetadata("Contact");
}

export default async function SiteContact() {
  return renderSitePage({ kind: "contact" });
}
