import { NextResponse, type NextRequest } from "next/server";
import { classifyHost, normalizeHost } from "@/lib/urls";

/**
 * Host-based routing. Runs on every request (except static assets):
 *  - apex domain           -> marketing site, /admin, /api
 *  - {slug}.PLATFORM_DOMAIN -> /dashboard, /api pass through; everything else is
 *                              rewritten to /tenant/{host}/... (public lodge site)
 *  - custom domain         -> same as subdomain (the page resolves entitlement)
 * Tenant resolution itself (DB lookups) happens in lib/tenant.ts, not here.
 */
export function proxy(req: NextRequest) {
  const host = normalizeHost(req.headers.get("host"));
  const kind = classifyHost(host);
  const { pathname, search } = req.nextUrl;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-tenant-host", host);
  requestHeaders.set("x-tenant-path", pathname);

  // /tenant/{host}/... is the internal form produced by the rewrite below. The
  // proxy can run again for the rewritten request (with an internal Host), so
  // take the tenant host from the path here. The [host] segment only ever
  // selects a *public* site, so a direct hit on this path is harmless.
  if (pathname.startsWith("/tenant/")) {
    const tenantHost = normalizeHost(pathname.split("/")[2]);
    if (classifyHost(tenantHost).kind === "invalid") {
      return new NextResponse("Not found", { status: 404 });
    }
    requestHeaders.set("x-tenant-host", tenantHost);
    requestHeaders.set("x-tenant-path", "/" + pathname.split("/").slice(3).join("/"));
    return NextResponse.next({ request: { headers: requestHeaders } });
  }
  if (pathname === "/tenant") {
    return new NextResponse("Not found", { status: 404 });
  }

  // API routes (Stripe webhooks, Caddy's TLS ask endpoint, iCal feeds) do
  // their own host handling and may be called on internal hostnames.
  if (pathname.startsWith("/api")) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (kind.kind === "apex") {
    if (pathname.startsWith("/dashboard")) {
      return new NextResponse("Not found", { status: 404 });
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (kind.kind === "invalid") {
    return new NextResponse("Not found", { status: 404 });
  }

  // Tenant host (platform subdomain or custom domain).
  if (pathname.startsWith("/admin") || pathname.startsWith("/signup") || pathname === "/login" || pathname === "/pricing") {
    return new NextResponse("Not found", { status: 404 });
  }
  if (pathname.startsWith("/dashboard")) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Build the rewrite from req.url (not nextUrl) so the origin matches the
  // incoming request; a mismatched origin is treated as an external rewrite in
  // standalone mode and the header overrides above would be dropped.
  const url = new URL(`/tenant/${host}${pathname === "/" ? "" : pathname}${search}`, req.url);
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt|woff2?)$).*)"],
};
