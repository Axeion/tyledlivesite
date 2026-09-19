import { NextResponse } from "next/server";
import { buildLodgeCalendar } from "@/lib/events/ical";
import { getCurrentTenant, isSiteLive } from "@/lib/tenant";
import { tenantDb } from "@/lib/tenant-db";
import { lodgeSubdomainUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

export async function GET() {
  const tenant = await getCurrentTenant();
  if (tenant.kind === "fallback") return NextResponse.redirect(tenant.redirectTo, 302);
  if (tenant.kind !== "lodge" || !isSiteLive(tenant.lodge)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const lodge = tenant.lodge;
  const events = await tenantDb(lodge.id).event.findMany({ orderBy: { startsAt: "asc" } });
  const ics = buildLodgeCalendar(lodge, events, lodgeSubdomainUrl(lodge.slug));
  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${lodge.slug}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
