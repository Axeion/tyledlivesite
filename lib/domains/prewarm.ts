import tls from "node:tls";
import { db } from "@/lib/db";
import { canUseCustomDomain } from "@/lib/entitlements";
import { env } from "@/lib/env";

/**
 * Certificate pre-warming.
 *
 * Caddy issues certificates on demand, inside the TLS handshake: the first
 * visitor to a brand-new hostname waits for a full ACME round trip (~4s) and
 * browsers frequently give up first, showing an SSL error on a lodge site that
 * was just published. This opens that first handshake ourselves, from the
 * worker, so a real visitor always arrives to a cached certificate.
 *
 * A bare TLS handshake is enough — issuance happens before any HTTP request —
 * so warming never touches the app.
 */

/** Opens one TLS handshake against the terminator, with `hostname` as SNI. */
export type TlsProbe = (hostname: string, target: Target, timeoutMs: number) => Promise<void>;

export interface Target {
  host: string;
  port: number;
}

export interface WarmResult {
  /** Hostnames that should have a certificate and had not been warmed yet. */
  pending: number;
  warmed: number;
  failed: number;
}

/** `host:port` of the TLS terminator; the port defaults to 443. */
export function parseTarget(value: string): Target | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(.+?)(?::(\d+))?$/.exec(trimmed);
  if (!match) return null;
  const port = match[2] ? Number.parseInt(match[2], 10) : 443;
  if (!Number.isFinite(port) || port <= 0 || port > 65535) return null;
  return { host: match[1], port };
}

const defaultProbe: TlsProbe = (hostname, target, timeoutMs) =>
  new Promise<void>((resolve, reject) => {
    const socket = tls.connect(
      {
        host: target.host,
        port: target.port,
        servername: hostname,
        // We only care that the handshake completed: that is what makes Caddy
        // obtain the certificate. Chain validation is not our job here, and
        // skipping it keeps warming usable behind an internal CA. A refusal to
        // issue still fails the handshake, so genuine problems surface.
        rejectUnauthorized: false,
      },
      () => {
        socket.end();
        resolve();
      },
    );
    socket.setTimeout(timeoutMs, () => socket.destroy(new Error(`handshake timed out after ${timeoutMs}ms`)));
    socket.once("error", reject);
  });

/**
 * Every hostname Caddy is expected to serve: the apex, one subdomain per lodge,
 * and verified custom domains whose lodge still holds the entitlement. Mirrors
 * the rules in `shouldIssueCertificate` — warming a host the ask endpoint would
 * refuse only wastes a handshake.
 *
 * `www` and the uploads host are named site blocks in the Caddyfile, so Caddy
 * obtains those at startup without being asked.
 */
export async function hostsNeedingCertificates(now: Date = new Date()): Promise<string[]> {
  const platformDomain = env.platformDomain;
  const hosts = [platformDomain];

  const lodges = await db.lodge.findMany({ select: { slug: true } });
  for (const lodge of lodges) hosts.push(`${lodge.slug}.${platformDomain}`);

  const domains = await db.domain.findMany({ where: { status: "VERIFIED" }, include: { lodge: true } });
  for (const domain of domains) {
    if (canUseCustomDomain(domain.lodge, now)) hosts.push(domain.hostname);
  }

  return [...new Set(hosts)];
}

/** Hosts warmed by this process; a restart re-warms, which is cheap once cached. */
const warmedHosts = new Set<string>();

export function resetWarmedHosts(): void {
  warmedHosts.clear();
}

export interface WarmOptions {
  probe?: TlsProbe;
  hosts?: string[];
  seen?: Set<string>;
  target?: Target | null;
  /**
   * Cap on new handshakes per pass. Let's Encrypt allows 50 certificates per
   * registered domain per week, so a burst of new lodges is spread over several
   * passes rather than firing every order at once.
   */
  maxPerPass?: number;
  timeoutMs?: number;
  now?: Date;
}

export async function runCertWarmPass(options: WarmOptions = {}): Promise<WarmResult> {
  const target = options.target !== undefined ? options.target : parseTarget(env.certWarm.target);
  if (!target) return { pending: 0, warmed: 0, failed: 0 };

  const probe = options.probe ?? defaultProbe;
  const seen = options.seen ?? warmedHosts;
  const maxPerPass = options.maxPerPass ?? env.certWarm.maxPerPass;
  const timeoutMs = options.timeoutMs ?? env.certWarm.timeoutMs;
  const hosts = options.hosts ?? (await hostsNeedingCertificates(options.now));

  const pending = hosts.filter((host) => !seen.has(host));
  let warmed = 0;
  let failed = 0;

  // Sequential on purpose: each miss is an ACME order, and parallel orders for
  // the same account gain nothing while making rate limits harder to reason about.
  for (const host of pending.slice(0, maxPerPass)) {
    try {
      await probe(host, target, timeoutMs);
      seen.add(host);
      warmed += 1;
    } catch (err) {
      // Left out of `seen` so the next pass retries it.
      failed += 1;
      console.error(`[worker:certwarm] ${host}:`, err instanceof Error ? err.message : err);
    }
  }

  return { pending: pending.length, warmed, failed };
}
