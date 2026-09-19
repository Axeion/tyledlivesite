import { env } from "@/lib/env";
import { lodgeHost } from "@/lib/urls";

export const VERIFY_LABEL = "_tyled-verify";
export const VERIFY_PREFIX = "tyled-verify=";

export class DomainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainValidationError";
  }
}

const HOSTNAME_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Normalise and validate a user-entered hostname. */
export function normalizeHostname(input: string, platformDomain = env.platformDomain): string {
  let host = (input ?? "").trim().toLowerCase();
  host = host.replace(/^https?:\/\//, "").split("/")[0].split(":")[0].replace(/\.$/, "");
  if (!host) throw new DomainValidationError("Enter a domain name");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    throw new DomainValidationError("IP addresses are not allowed");
  }
  if (!HOSTNAME_RE.test(host)) throw new DomainValidationError("That does not look like a valid domain name");
  if (host === platformDomain || host.endsWith(`.${platformDomain}`)) {
    throw new DomainValidationError(`Domains under ${platformDomain} are reserved`);
  }
  return host;
}

/** Heuristic: two labels (example.org) is treated as an apex domain. */
export function isApexDomain(hostname: string): boolean {
  return hostname.split(".").length <= 2;
}

export interface DnsRecordInstruction {
  type: "CNAME" | "A" | "TXT";
  name: string;
  value: string;
  note?: string;
}

export function verificationRecordName(hostname: string): string {
  return `${VERIFY_LABEL}.${hostname}`;
}

export function verificationRecordValue(token: string): string {
  return `${VERIFY_PREFIX}${token}`;
}

/** The DNS records a lodge must create for `hostname` to be verified and routed. */
export function dnsInstructions(hostname: string, slug: string, token: string): DnsRecordInstruction[] {
  const target = lodgeHost(slug);
  const records: DnsRecordInstruction[] = [
    { type: "TXT", name: verificationRecordName(hostname), value: verificationRecordValue(token), note: "Proves you control the domain." },
  ];
  if (isApexDomain(hostname)) {
    const ips = (process.env.PLATFORM_IPS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (ips.length > 0) {
      for (const ip of ips) records.push({ type: "A", name: hostname, value: ip, note: "Apex domains cannot use CNAME at most registrars." });
    } else {
      records.push({ type: "CNAME", name: hostname, value: target, note: "Use an ALIAS/ANAME record if your DNS provider does not allow CNAME at the apex." });
    }
  } else {
    records.push({ type: "CNAME", name: hostname, value: target });
  }
  return records;
}
