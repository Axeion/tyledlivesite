import { NextResponse, type NextRequest } from "next/server";
import { consumeLoginToken } from "@/lib/auth/login-token";
import { createSession } from "@/lib/auth/session";
import { getCurrentTenant } from "@/lib/tenant";
import { lodgeSubdomainUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

/** Exchanges a one-time login token (issued on the apex) for a session on this subdomain. */
export async function GET(req: NextRequest) {
  const tenant = await getCurrentTenant();
  if (tenant.kind !== "lodge" || tenant.via !== "subdomain") {
    return new NextResponse("Not found", { status: 404 });
  }
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const result = await consumeLoginToken(token, tenant.lodge.id);
  // Build the absolute redirect from the lodge's public URL: the request origin
  // seen here is the internal server address, not the browser-facing host.
  const dest = lodgeSubdomainUrl(tenant.lodge.slug, result ? "/dashboard?welcome=1" : "/dashboard/login?error=expired");
  if (result) await createSession(result.userId);
  return NextResponse.redirect(dest, 303);
}
