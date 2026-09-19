import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { isSiteLive, resolveTenantFromHost } from "@/lib/tenant";
import { makeLodge, resetDatabase } from "./helpers";

describe("tenant resolution from Host header", () => {
  beforeEach(resetDatabase);

  it("resolves subdomains and the apex", async () => {
    const lodge = await makeLodge({ slug: "alpha" });
    expect(await resolveTenantFromHost("tyled.test")).toEqual({ kind: "apex" });
    const r = await resolveTenantFromHost("alpha.tyled.test:3000");
    expect(r.kind).toBe("lodge");
    if (r.kind === "lodge") expect(r.lodge.id).toBe(lodge.id);
    expect(await resolveTenantFromHost("nope.tyled.test")).toEqual({ kind: "none" });
  });

  it("serves verified custom domains only while entitled, else falls back to the subdomain", async () => {
    const lodge = await makeLodge({ slug: "beta", plan: "PAID", subscriptionStatus: "active" });
    await db.domain.create({ data: { lodgeId: lodge.id, hostname: "beta-lodge.org", verificationToken: "t", status: "VERIFIED" } });
    const live = await resolveTenantFromHost("beta-lodge.org", "/events");
    expect(live.kind).toBe("lodge");

    await db.lodge.update({ where: { id: lodge.id }, data: { plan: "FREE", subscriptionStatus: "canceled" } });
    const lapsed = await resolveTenantFromHost("beta-lodge.org", "/events");
    expect(lapsed).toMatchObject({ kind: "fallback", redirectTo: "http://beta.tyled.test:3000/events" });
    // The subdomain keeps working.
    expect((await resolveTenantFromHost("beta.tyled.test")).kind).toBe("lodge");
  });

  it("ignores unverified custom domains", async () => {
    const lodge = await makeLodge({ plan: "PAID", subscriptionStatus: "active" });
    await db.domain.create({ data: { lodgeId: lodge.id, hostname: "pending.org", verificationToken: "t", status: "PENDING" } });
    expect(await resolveTenantFromHost("pending.org")).toEqual({ kind: "none" });
  });

  it("only serves approved and published lodges", () => {
    expect(isSiteLive({ status: "APPROVED", published: true })).toBe(true);
    expect(isSiteLive({ status: "APPROVED", published: false })).toBe(false);
    expect(isSiteLive({ status: "PENDING_REVIEW", published: true })).toBe(false);
  });
});
