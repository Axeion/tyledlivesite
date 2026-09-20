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

/** Consecutive failed checks before a VERIFIED domain is taken out of service. */
export const DOWNGRADE_AFTER_FAILURES = 3;

/** Re-checks one domain and persists the result. */
export async function checkDomain(domain: Domain, dns?: DnsLookup): Promise<Domain> {
  const lodge = await db.lodge.findUniqueOrThrow({ where: { id: domain.lodgeId } });
  const result = await verifyDomain(domain.hostname, lodge.slug, domain.verificationToken, dns);
  const now = new Date();
  const error = result.ok
    ? null
    : result.error ??
      (!result.txtOk && !result.routeOk
        ? "TXT and CNAME/A records not found yet"
        : !result.txtOk
          ? "TXT verification record not found"
          : "CNAME/A record does not point to the platform");

  if (result.ok) {
    return db.domain.update({
      where: { id: domain.id },
      data: { status: "VERIFIED", failureCount: 0, lastCheckedAt: now, verifiedAt: domain.verifiedAt ?? now, lastError: null },
    });
  }

  // Resolver errors (timeouts, SERVFAIL) are not evidence the records are gone.
  const definiteFailure = !result.error;
  const failureCount = definiteFailure ? domain.failureCount + 1 : domain.failureCount;
  // A verified domain keeps serving until it has clearly lost its records
  // several checks in a row; then it is marked FAILED and stops resolving.
  const downgrade = domain.status === "VERIFIED" && failureCount >= DOWNGRADE_AFTER_FAILURES;
  const status = domain.status === "VERIFIED" ? (downgrade ? "FAILED" : "VERIFIED") : domain.status === "FAILED" ? "FAILED" : "PENDING";
  return db.domain.update({
    where: { id: domain.id },
    data: {
      status,
      failureCount,
      lastCheckedAt: now,
      verifiedAt: downgrade ? null : domain.verifiedAt,
      lastError: status === "VERIFIED" ? `Last check failed (${failureCount}/${DOWNGRADE_AFTER_FAILURES}): ${error}` : error,
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
