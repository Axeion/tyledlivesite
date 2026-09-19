import { Resolver } from "node:dns/promises";
import { env } from "@/lib/env";
import { lodgeHost } from "@/lib/urls";
import { verificationRecordName, verificationRecordValue } from "@/lib/domains/instructions";

export interface VerificationOutcome {
  ok: boolean;
  txtOk: boolean;
  routeOk: boolean;
  error: string | null;
}

export interface DnsLookup {
  resolveTxt(host: string): Promise<string[][]>;
  resolveCname(host: string): Promise<string[]>;
  resolve4(host: string): Promise<string[]>;
}

export function systemResolver(): DnsLookup {
  const r = new Resolver({ timeout: 5000, tries: 2 });
  if (env.domains.dnsResolver) {
    r.setServers([env.domains.dnsResolver]);
  }
  return r;
}

function normalizeTarget(t: string): string {
  return t.toLowerCase().replace(/\.$/, "");
}

/**
 * A domain is verified when its `_tyled-verify` TXT record carries the lodge's
 * token (ownership) AND traffic for the hostname is routed to the platform via
 * CNAME to the lodge's subdomain, or via A records (apex domains). Missing
 * records are reported as not-ok rather than thrown; only unexpected resolver
 * errors are surfaced in `error`.
 */
export async function verifyDomain(
  hostname: string,
  slug: string,
  token: string,
  dns: DnsLookup = systemResolver(),
): Promise<VerificationOutcome> {
  const expectedTxt = verificationRecordValue(token);
  const expectedCname = normalizeTarget(lodgeHost(slug));
  let txtOk = false;
  let routeOk = false;
  const errors: string[] = [];

  try {
    const txts = await dns.resolveTxt(verificationRecordName(hostname));
    txtOk = txts.some((chunks) => chunks.join("") === expectedTxt);
  } catch (err) {
    if (!isNotFound(err)) errors.push(`TXT lookup failed: ${(err as Error).message}`);
  }

  try {
    const cnames = await dns.resolveCname(hostname);
    routeOk = cnames.map(normalizeTarget).includes(expectedCname);
  } catch (err) {
    if (!isNotFound(err)) errors.push(`CNAME lookup failed: ${(err as Error).message}`);
  }

  if (!routeOk) {
    try {
      const ips = await dns.resolve4(hostname);
      const allowed = (process.env.PLATFORM_IPS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      routeOk = ips.length > 0 && (allowed.length === 0 || ips.some((ip) => allowed.includes(ip)));
    } catch (err) {
      if (!isNotFound(err)) errors.push(`A lookup failed: ${(err as Error).message}`);
    }
  }

  return { ok: txtOk && routeOk, txtOk, routeOk, error: errors.length ? errors.join("; ") : null };
}

function isNotFound(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === "ENOTFOUND" || code === "ENODATA" || code === "ESERVFAIL" || code === "EREFUSED";
}
