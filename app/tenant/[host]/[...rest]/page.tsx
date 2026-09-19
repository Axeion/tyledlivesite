import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/** Any path a lodge site does not define is a 404 (never leaks platform routes). */
export default function SiteCatchAll() {
  notFound();
}
