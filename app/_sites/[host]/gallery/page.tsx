import { renderSitePage, siteMetadata } from "@/lib/site-render";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return siteMetadata("Gallery");
}

export default async function SiteGallery() {
  return renderSitePage({ kind: "gallery" });
}
