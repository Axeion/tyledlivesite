import { NextResponse, type NextRequest } from "next/server";
import { shouldIssueCertificate } from "@/lib/domains/tls-ask";

export const dynamic = "force-dynamic";

/**
 * Caddy on-demand TLS "ask" endpoint. Caddy calls GET ?domain=<host> before
 * obtaining a certificate; 200 = issue, anything else = refuse. This route
 * must only be reachable from Caddy (internal Docker network; see Caddyfile).
 */
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain") ?? "";
  const { allow, reason } = await shouldIssueCertificate(domain);
  return new NextResponse(reason, { status: allow ? 200 : 403, headers: { "Cache-Control": "no-store" } });
}
