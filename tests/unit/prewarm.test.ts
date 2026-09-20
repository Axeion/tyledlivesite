import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  hostsNeedingCertificates,
  parseTarget,
  runCertWarmPass,
  type Target,
  type TlsProbe,
} from "@/lib/domains/prewarm";
import { makeLodge, resetDatabase } from "./helpers";

const target: Target = { host: "caddy", port: 443 };

/** Records every host handshaked, and fails the ones named in `failing`. */
function spyProbe(failing: string[] = []): TlsProbe & { calls: string[] } {
  const calls: string[] = [];
  const probe: TlsProbe = async (hostname) => {
    calls.push(hostname);
    if (failing.includes(hostname)) throw new Error("tlsv1 alert internal error");
  };
  return Object.assign(probe, { calls });
}

describe("parseTarget", () => {
  it("defaults the port to 443 and rejects unusable values", () => {
    expect(parseTarget("caddy")).toEqual({ host: "caddy", port: 443 });
    expect(parseTarget(" caddy:8443 ")).toEqual({ host: "caddy", port: 8443 });
    expect(parseTarget("")).toBeNull();
    expect(parseTarget("   ")).toBeNull();
    expect(parseTarget("caddy:0")).toBeNull();
    expect(parseTarget("caddy:99999")).toBeNull();
  });
});

describe("hostsNeedingCertificates", () => {
  beforeEach(resetDatabase);

  it("covers the apex and one subdomain per lodge", async () => {
    await makeLodge({ slug: "demo-lodge" });
    await makeLodge({ slug: "harmony-lodge" });

    expect((await hostsNeedingCertificates()).sort()).toEqual([
      "demo-lodge.tyled.test",
      "harmony-lodge.tyled.test",
      "tyled.test",
    ]);
  });

  it("includes verified custom domains only while the lodge is entitled to them", async () => {
    const paid = await makeLodge({ slug: "paid-lodge", plan: "PAID", subscriptionStatus: "active" });
    const free = await makeLodge({ slug: "free-lodge", plan: "FREE" });
    await db.domain.create({
      data: { lodgeId: paid.id, hostname: "paidlodge.example", verificationToken: "t1", status: "VERIFIED" },
    });
    // Same state, but the plan no longer carries the entitlement.
    await db.domain.create({
      data: { lodgeId: free.id, hostname: "freelodge.example", verificationToken: "t2", status: "VERIFIED" },
    });
    // Verified-but-lapsed subscription: the ask endpoint would refuse this too.
    const lapsed = await makeLodge({ slug: "lapsed-lodge", plan: "PAID", subscriptionStatus: "canceled" });
    await db.domain.create({
      data: { lodgeId: lapsed.id, hostname: "lapsedlodge.example", verificationToken: "t3", status: "VERIFIED" },
    });

    const hosts = await hostsNeedingCertificates();
    expect(hosts).toContain("paidlodge.example");
    expect(hosts).not.toContain("freelodge.example");
    expect(hosts).not.toContain("lapsedlodge.example");
  });

  it("skips domains that are not verified yet", async () => {
    const lodge = await makeLodge({ slug: "pending-lodge", plan: "PAID", subscriptionStatus: "active" });
    await db.domain.create({
      data: { lodgeId: lodge.id, hostname: "pending.example", verificationToken: "t4", status: "PENDING" },
    });
    await db.domain.create({
      data: { lodgeId: lodge.id, hostname: "failed.example", verificationToken: "t5", status: "FAILED" },
    });

    const hosts = await hostsNeedingCertificates();
    expect(hosts).not.toContain("pending.example");
    expect(hosts).not.toContain("failed.example");
  });
});

describe("runCertWarmPass", () => {
  it("does nothing when no terminator is configured", async () => {
    const probe = spyProbe();
    const result = await runCertWarmPass({ target: null, probe, hosts: ["a.tyled.test"], seen: new Set() });

    expect(result).toEqual({ pending: 0, warmed: 0, failed: 0 });
    expect(probe.calls).toEqual([]);
  });

  it("warms each host once and skips it on later passes", async () => {
    const probe = spyProbe();
    const seen = new Set<string>();
    const hosts = ["tyled.test", "a.tyled.test"];

    const first = await runCertWarmPass({ target, probe, hosts, seen });
    expect(first).toEqual({ pending: 2, warmed: 2, failed: 0 });

    const second = await runCertWarmPass({ target, probe, hosts, seen });
    expect(second).toEqual({ pending: 0, warmed: 0, failed: 0 });
    expect(probe.calls).toEqual(["tyled.test", "a.tyled.test"]);
  });

  it("retries a host whose handshake failed", async () => {
    const seen = new Set<string>();
    const hosts = ["good.tyled.test", "bad.tyled.test"];

    const failing = spyProbe(["bad.tyled.test"]);
    expect(await runCertWarmPass({ target, probe: failing, hosts, seen })).toEqual({ pending: 2, warmed: 1, failed: 1 });

    // Only the failure is retried; the success stays warmed.
    const recovered = spyProbe();
    expect(await runCertWarmPass({ target, probe: recovered, hosts, seen })).toEqual({ pending: 1, warmed: 1, failed: 0 });
    expect(recovered.calls).toEqual(["bad.tyled.test"]);
  });

  it("spreads a burst of new hosts across passes to respect ACME rate limits", async () => {
    const probe = spyProbe();
    const seen = new Set<string>();
    const hosts = Array.from({ length: 5 }, (_, i) => `lodge-${i}.tyled.test`);

    const first = await runCertWarmPass({ target, probe, hosts, seen, maxPerPass: 2 });
    expect(first).toEqual({ pending: 5, warmed: 2, failed: 0 });
    expect(probe.calls).toEqual(["lodge-0.tyled.test", "lodge-1.tyled.test"]);

    await runCertWarmPass({ target, probe, hosts, seen, maxPerPass: 2 });
    expect(probe.calls).toHaveLength(4);

    const last = await runCertWarmPass({ target, probe, hosts, seen, maxPerPass: 2 });
    expect(last).toEqual({ pending: 1, warmed: 1, failed: 0 });
    expect(probe.calls).toHaveLength(5);
  });
});
