import { db } from "@/lib/db";
import { randomToken } from "@/lib/auth/tokens";
import { canUseCustomDomain } from "@/lib/entitlements";
import { DomainValidationError, normalizeHostname } from "@/lib/domains/instructions";
import { verifyDomain, type DnsLookup } from "@/lib/domains/verify";
import type { Domain } from "@/generated/prisma/client";

/**
 * Adds a custom domain for a lodge. Requires the custom-domain entitlement and
 * a hostname that is not claimed by another lodge.
 */
export async function addDomain(lodgeId: string, input: string): Promise<Domain> {
  const lodge = await db.lodge.findUniqueOrThrow({ where: { id: lodgeId } });
  if (!canUseCustomDomain(lodge)) {
    throw new DomainValidationError("Custom domains require the paid plan");
  }
  const hostname = normalizeHostname(input);
  const existing = await db.domain.findUnique({ where: { hostname } });
  if (existing && existing.lodgeId !== lodgeId) {
    throw new DomainValidationError("That domain is already in use");
  }
  if (existing) return existing;
  return db.domain.create({ data: { lodgeId, hostname, verificationToken: randomToken(16) } });
}

/** Re-checks one domain and persists the result. */
export async function checkDomain(domain: Domain, dns?: DnsLookup): Promise<Domain> {
  const lodge = await db.lodge.findUniqueOrThrow({ where: { id: domain.lodgeId } });
  const result = await verifyDomain(domain.hostname, lodge.slug, domain.verificationToken, dns);
  const now = new Date();
  const status = result.ok ? "VERIFIED" : domain.status === "VERIFIED" ? "VERIFIED" : "PENDING";
  // A previously verified domain that stops resolving is downgraded after the
  // worker sees it fail; a single transient failure keeps VERIFIED.
  const downgraded = domain.status === "VERIFIED" && !result.ok && !result.error;
  const error = result.ok
    ? null
    : result.error ??
      (!result.txtOk && !result.routeOk
        ? "TXT and CNAME/A records not found yet"
        : !result.txtOk
          ? "TXT verification record not found"
          : "CNAME/A record does not point to the platform");
  return db.domain.update({
    where: { id: domain.id },
    data: {
      status: downgraded ? "FAILED" : status,
      lastCheckedAt: now,
      verifiedAt: result.ok ? (domain.verifiedAt ?? now) : downgraded ? null : domain.verifiedAt,
      lastError: error,
    },
  });
}

/** One verification pass over every domain that still needs checking. Used by the worker. */
export async function runDomainVerificationPass(dns?: DnsLookup): Promise<{ checked: number; verified: number }> {
  const domains = await db.domain.findMany({ where: { status: { in: ["PENDING", "FAILED", "VERIFIED"] } } });
  let verified = 0;
  for (const d of domains) {
    try {
      const updated = await checkDomain(d, dns);
      if (updated.status === "VERIFIED" && d.status !== "VERIFIED") {
        verified += 1;
        await db.auditLog.create({ data: { lodgeId: d.lodgeId, action: "domain.verified", meta: { hostname: d.hostname } } });
      }
    } catch (err) {
      console.error(`[domains] check failed for ${d.hostname}:`, err);
    }
  }
  return { checked: domains.length, verified };
}
