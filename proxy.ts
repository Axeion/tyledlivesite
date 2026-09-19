import { NextResponse, type NextRequest } from "next/server";
import { classifyHost, normalizeHost } from "@/lib/urls";

/**
 * Host-based routing. Runs on every request (except static assets):
 *  - apex domain           -> marketing site, /admin, /api
 *  - {slug}.PLATFORM_DOMAIN -> /dashboard, /api pass through; everything else is
 *                              rewritten to /_sites/{host}/... (public lodge site)
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

  // Internal site routes are never addressable directly.
  if (pathname.startsWith("/_sites")) {
    return new NextResponse("Not found", { status: 404 });
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
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/api")) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const url = req.nextUrl.clone();
  url.pathname = `/_sites/${host}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt|woff2?)$).*)"],
};
