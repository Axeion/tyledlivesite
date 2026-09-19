import { headers } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { canUseCustomDomain } from "@/lib/entitlements";
import { classifyHost, lodgeSubdomainUrl, normalizeHost } from "@/lib/urls";
import type { Lodge } from "@/generated/prisma/client";

export const TENANT_HOST_HEADER = "x-tenant-host";

export type TenantResolution =
  | { kind: "apex" }
  | { kind: "lodge"; lodge: Lodge; via: "subdomain" | "custom" }
  /** Custom domain exists and is verified but the lodge no longer has the entitlement. */
  | { kind: "fallback"; lodge: Lodge; redirectTo: string }
  | { kind: "none" };

/**
 * Resolve the lodge for a host. Custom domains only resolve while they are
 * VERIFIED and the lodge holds the custom-domain entitlement; otherwise the
 * caller is told to redirect to the lodge's platform subdomain so the site
 * never goes dark.
 */
export async function resolveTenantFromHost(hostHeader: string | null | undefined, path = "/"): Promise<TenantResolution> {
  const host = normalizeHost(hostHeader);
  const kind = classifyHost(host);
  switch (kind.kind) {
    case "apex":
      return { kind: "apex" };
    case "subdomain": {
      const lodge = await db.lodge.findUnique({ where: { slug: kind.slug } });
      return lodge ? { kind: "lodge", lodge, via: "subdomain" } : { kind: "none" };
    }
    case "custom": {
      const domain = await db.domain.findUnique({ where: { hostname: kind.hostname }, include: { lodge: true } });
      if (!domain || domain.status !== "VERIFIED") return { kind: "none" };
      if (!canUseCustomDomain(domain.lodge)) {
        return { kind: "fallback", lodge: domain.lodge, redirectTo: lodgeSubdomainUrl(domain.lodge.slug, path) };
      }
      return { kind: "lodge", lodge: domain.lodge, via: "custom" };
    }
    default:
      return { kind: "none" };
  }
}

/** Host of the current request as seen by the proxy (set in proxy.ts). */
export async function currentHost(): Promise<string> {
  const h = await headers();
  return normalizeHost(h.get(TENANT_HOST_HEADER) ?? h.get("host"));
}

/** Lodge for the current request's host, memoised per request. */
export const getCurrentTenant = cache(async (): Promise<TenantResolution> => {
  const h = await headers();
  const tenantHost = h.get(TENANT_HOST_HEADER);
  const result = await resolveTenantFromHost(tenantHost ?? h.get("host"), h.get("x-tenant-path") ?? "/");
  if (result.kind === "none") {
    console.warn(`[tenant] unresolved host: x-tenant-host=${tenantHost ?? "-"} host=${h.get("host") ?? "-"}`);
  }
  return result;
});

/** True when the lodge's public site should be served. */
export function isSiteLive(lodge: Pick<Lodge, "status" | "published">): boolean {
  return lodge.status === "APPROVED" && lodge.published;
}
