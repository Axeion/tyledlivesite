import { db } from "@/lib/db";
import { canUseCustomDomain } from "@/lib/entitlements";
import { classifyHost, normalizeHost } from "@/lib/urls";

/**
 * Decides whether Caddy may issue a certificate for `domain` (on-demand TLS
 * "ask" endpoint). Approves the apex, any platform subdomain, and verified
 * custom domains whose lodge currently holds the custom-domain entitlement.
 */
export async function shouldIssueCertificate(domainInput: string): Promise<{ allow: boolean; reason: string }> {
  const host = normalizeHost(domainInput);
  const kind = classifyHost(host);
  switch (kind.kind) {
    case "apex":
      return { allow: true, reason: "apex" };
    case "subdomain": {
      const lodge = await db.lodge.findUnique({ where: { slug: kind.slug }, select: { id: true } });
      return lodge ? { allow: true, reason: "subdomain" } : { allow: false, reason: "unknown subdomain" };
    }
    case "custom": {
      const domain = await db.domain.findUnique({ where: { hostname: kind.hostname }, include: { lodge: true } });
      if (!domain) return { allow: false, reason: "unknown domain" };
      if (domain.status !== "VERIFIED") return { allow: false, reason: "domain not verified" };
      if (!canUseCustomDomain(domain.lodge)) return { allow: false, reason: "plan does not include custom domains" };
      return { allow: true, reason: "verified custom domain" };
    }
    default:
      return { allow: false, reason: "invalid host" };
  }
}
