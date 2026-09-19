import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { DomainValidationError, dnsInstructions, normalizeHostname } from "@/lib/domains/instructions";
import { addDomain, checkDomain, runDomainVerificationPass } from "@/lib/domains/service";
import { shouldIssueCertificate } from "@/lib/domains/tls-ask";
import { verifyDomain, type DnsLookup } from "@/lib/domains/verify";
import { makeLodge, resetDatabase } from "./helpers";

function fakeDns(records: { txt?: Record<string, string[]>; cname?: Record<string, string[]>; a?: Record<string, string[]> }): DnsLookup {
  const notFound = () => Object.assign(new Error("queryTxt ENOTFOUND"), { code: "ENOTFOUND" });
  return {
    async resolveTxt(host) {
      const v = records.txt?.[host];
      if (!v) throw notFound();
      return v.map((s) => [s]);
    },
    async resolveCname(host) {
      const v = records.cname?.[host];
      if (!v) throw notFound();
      return v;
    },
    async resolve4(host) {
      const v = records.a?.[host];
      if (!v) throw notFound();
      return v;
    },
  };
}

describe("hostname validation and instructions", () => {
  it("normalises and validates hostnames", () => {
    expect(normalizeHostname(" HTTPS://Lodge.Example.ORG/path ")).toBe("lodge.example.org");
    expect(() => normalizeHostname("demo.tyled.test")).toThrow(DomainValidationError);
    expect(() => normalizeHostname("tyled.test")).toThrow(DomainValidationError);
    expect(() => normalizeHostname("1.2.3.4")).toThrow(DomainValidationError);
    expect(() => normalizeHostname("not a domain")).toThrow(DomainValidationError);
    expect(() => normalizeHostname("")).toThrow(DomainValidationError);
  });

  it("produces TXT + CNAME instructions", () => {
    const recs = dnsInstructions("www.lodge.org", "demo-lodge", "abc123");
    expect(recs).toContainEqual(expect.objectContaining({ type: "TXT", name: "_tyled-verify.www.lodge.org", value: "tyled-verify=abc123" }));
    expect(recs).toContainEqual(expect.objectContaining({ type: "CNAME", name: "www.lodge.org", value: "demo-lodge.tyled.test" }));
  });
});

describe("verifyDomain", () => {
  it("verifies when TXT token and CNAME both match", async () => {
    const dns = fakeDns({
      txt: { "_tyled-verify.lodge.org": ["tyled-verify=tok"] },
      cname: { "lodge.org": ["demo-lodge.tyled.test."] },
    });
    const r = await verifyDomain("lodge.org", "demo-lodge", "tok", dns);
    expect(r).toMatchObject({ ok: true, txtOk: true, routeOk: true, error: null });
  });

  it("accepts A records for apex domains", async () => {
    const dns = fakeDns({ txt: { "_tyled-verify.lodge.org": ["tyled-verify=tok"] }, a: { "lodge.org": ["203.0.113.10"] } });
    expect((await verifyDomain("lodge.org", "demo-lodge", "tok", dns)).ok).toBe(true);
  });

  it("fails on wrong token or wrong CNAME target", async () => {
    const wrongTxt = fakeDns({ txt: { "_tyled-verify.lodge.org": ["tyled-verify=nope"] }, cname: { "lodge.org": ["demo-lodge.tyled.test"] } });
    expect(await verifyDomain("lodge.org", "demo-lodge", "tok", wrongTxt)).toMatchObject({ ok: false, txtOk: false, routeOk: true });
    const wrongCname = fakeDns({ txt: { "_tyled-verify.lodge.org": ["tyled-verify=tok"] }, cname: { "lodge.org": ["other-lodge.tyled.test"] } });
    expect(await verifyDomain("lodge.org", "demo-lodge", "tok", wrongCname)).toMatchObject({ ok: false, txtOk: true, routeOk: false });
    const nothing = fakeDns({});
    expect(await verifyDomain("lodge.org", "demo-lodge", "tok", nothing)).toMatchObject({ ok: false, error: null });
  });
});

describe("domain service and TLS ask endpoint", () => {
  beforeEach(resetDatabase);

  it("requires the paid plan to add a domain", async () => {
    const free = await makeLodge({ plan: "FREE" });
    await expect(addDomain(free.id, "lodge.org")).rejects.toThrow(/paid plan/);
    const paid = await makeLodge({ plan: "PAID", subscriptionStatus: "active" });
    const d = await addDomain(paid.id, "lodge.org");
    expect(d.status).toBe("PENDING");
    expect(d.verificationToken).toHaveLength(32);
    await expect(addDomain((await makeLodge({ plan: "PAID" })).id, "lodge.org")).rejects.toThrow(/already in use/);
  });

  it("verifies through the worker pass and approves TLS only when verified and entitled", async () => {
    const paid = await makeLodge({ plan: "PAID", subscriptionStatus: "active" });
    const d = await addDomain(paid.id, "lodge.org");
    expect(await shouldIssueCertificate("lodge.org")).toMatchObject({ allow: false });

    const dns = fakeDns({
      txt: { "_tyled-verify.lodge.org": [`tyled-verify=${d.verificationToken}`] },
      cname: { "lodge.org": [`${paid.slug}.tyled.test`] },
    });
    const pass = await runDomainVerificationPass(dns);
    expect(pass).toEqual({ checked: 1, verified: 1 });
    const updated = await db.domain.findUniqueOrThrow({ where: { id: d.id } });
    expect(updated.status).toBe("VERIFIED");
    expect(await shouldIssueCertificate("lodge.org")).toMatchObject({ allow: true });
    expect(await shouldIssueCertificate("LODGE.ORG.")).toMatchObject({ allow: true });

    // Subscription lapses: certificate issuance is refused, record stays VERIFIED.
    await db.lodge.update({ where: { id: paid.id }, data: { plan: "FREE", subscriptionStatus: "canceled" } });
    expect(await shouldIssueCertificate("lodge.org")).toMatchObject({ allow: false, reason: expect.stringMatching(/plan/) });
    expect((await db.domain.findUniqueOrThrow({ where: { id: d.id } })).status).toBe("VERIFIED");
  });

  it("approves the apex and existing subdomains, refuses unknown hosts", async () => {
    const lodge = await makeLodge({ slug: "known-lodge" });
    expect(await shouldIssueCertificate("tyled.test")).toMatchObject({ allow: true });
    expect(await shouldIssueCertificate(`${lodge.slug}.tyled.test`)).toMatchObject({ allow: true });
    expect(await shouldIssueCertificate("nobody.tyled.test")).toMatchObject({ allow: false });
    expect(await shouldIssueCertificate("evil.example.org")).toMatchObject({ allow: false });
    expect(await shouldIssueCertificate("")).toMatchObject({ allow: false });
  });

  it("marks a verified domain FAILED when its records disappear", async () => {
    const paid = await makeLodge({ plan: "PAID", subscriptionStatus: "active" });
    const d = await db.domain.create({
      data: { lodgeId: paid.id, hostname: "gone.org", verificationToken: "t", status: "VERIFIED", verifiedAt: new Date() },
    });
    const after = await checkDomain(d, fakeDns({}));
    expect(after.status).toBe("FAILED");
    expect(after.lastError).toMatch(/not found/);
  });
});
