import { env } from "@/lib/env";

/** Host (without scheme) for a lodge's platform subdomain, including dev port if configured. */
export function lodgeHost(slug: string): string {
  return `${slug}.${env.platformDomain}`;
}

function withPort(host: string): string {
  return env.platformPort ? `${host}:${env.platformPort}` : host;
}

/** Absolute URL on the apex (marketing/admin) domain. */
export function apexUrl(path = "/"): string {
  return `${env.platformScheme}://${withPort(env.platformDomain)}${path}`;
}

/** Absolute URL on a lodge's platform subdomain. */
export function lodgeSubdomainUrl(slug: string, path = "/"): string {
  return `${env.platformScheme}://${withPort(lodgeHost(slug))}${path}`;
}

/** Strip a port from a Host header value and lowercase it. */
export function normalizeHost(hostHeader: string | null | undefined): string {
  if (!hostHeader) return "";
  return hostHeader.split(":")[0].trim().toLowerCase().replace(/\.$/, "");
}

export type HostKind =
  | { kind: "apex" }
  | { kind: "subdomain"; slug: string }
  | { kind: "custom"; hostname: string }
  | { kind: "invalid" };

/** Classify a normalized host relative to PLATFORM_DOMAIN. */
export function classifyHost(host: string, platformDomain = env.platformDomain): HostKind {
  if (!host) return { kind: "invalid" };
  if (host === platformDomain || host === `www.${platformDomain}`) return { kind: "apex" };
  if (host.endsWith(`.${platformDomain}`)) {
    const label = host.slice(0, -(platformDomain.length + 1));
    if (!label || label.includes(".")) return { kind: "invalid" };
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) return { kind: "invalid" };
    return { kind: "subdomain", slug: label };
  }
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) {
    return { kind: "invalid" };
  }
  return { kind: "custom", hostname: host };
}
