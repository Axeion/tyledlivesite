import { renderSitePage, siteMetadata } from "@/lib/site-render";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return siteMetadata(slug);
}

export default async function SiteCustomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderSitePage({ kind: "page", slug });
}
