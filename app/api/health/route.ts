import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { classifyHost, normalizeHost } from "@/lib/urls";

export const dynamic = "force-dynamic";

/** Liveness + routing diagnostics: reports how this request's Host header is classified. */
export async function GET(req: NextRequest) {
  const host = normalizeHost(req.headers.get("x-tenant-host") ?? req.headers.get("host"));
  let database = "ok";
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    database = "unreachable";
  }
  return NextResponse.json(
    { ok: database === "ok", database, host, classification: classifyHost(host), platformDomain: process.env.PLATFORM_DOMAIN ?? null },
    { status: database === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
