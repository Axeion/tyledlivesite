import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export interface AddressParts {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MIN_INTERVAL_MS = 1100; // Nominatim policy: max 1 request/second

export function formatAddress(parts: AddressParts): string {
  return [parts.addressLine1, parts.addressLine2, parts.city, parts.region, parts.postalCode, parts.country]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

export function normalizeQuery(q: string): string {
  return q.toLowerCase().replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
}

function queryHash(q: string): string {
  return createHash("sha256").update(normalizeQuery(q)).digest("hex");
}

// Simple in-process queue so concurrent geocodes never exceed 1 req/s.
let chain: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return fn();
  };
  const p = chain.then(run, run);
  chain = p.catch(() => undefined);
  return p;
}

interface NominatimHit {
  lat: string;
  lon: string;
  display_name: string;
}

export async function fetchNominatim(query: string, fetchImpl: typeof fetch = fetch): Promise<GeocodeResult | null> {
  const url = new URL(`${env.nominatim.baseUrl}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  const res = await throttled(() =>
    fetchImpl(url, {
      headers: { "User-Agent": env.nominatim.userAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    }),
  );
  if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);
  const hits = (await res.json()) as NominatimHit[];
  const hit = hits[0];
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, displayName: hit.display_name };
}

/**
 * Geocode a free-form address with a persistent cache. Returns null when the
 * address cannot be found (that outcome is cached too, to avoid hammering
 * Nominatim with the same bad address).
 */
export async function geocodeAddress(query: string, fetchImpl?: typeof fetch): Promise<GeocodeResult | null> {
  const q = normalizeQuery(query);
  if (!q) return null;
  const hash = queryHash(q);
  const cached = await db.geocodeCache.findUnique({ where: { queryHash: hash } });
  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
    return cached.lat !== null && cached.lng !== null
      ? { lat: cached.lat, lng: cached.lng, displayName: cached.displayName ?? q }
      : null;
  }
  const result = await fetchNominatim(q, fetchImpl);
  await db.geocodeCache.upsert({
    where: { queryHash: hash },
    create: { queryHash: hash, query: q, lat: result?.lat, lng: result?.lng, displayName: result?.displayName },
    update: { lat: result?.lat ?? null, lng: result?.lng ?? null, displayName: result?.displayName ?? null, fetchedAt: new Date() },
  });
  return result;
}

/** Geocode a lodge's stored address and persist lat/lng on the lodge row. */
export async function geocodeLodge(lodgeId: string, fetchImpl?: typeof fetch): Promise<GeocodeResult | null> {
  const lodge = await db.lodge.findUnique({ where: { id: lodgeId } });
  if (!lodge) return null;
  const address = formatAddress(lodge);
  if (!address) {
    await db.lodge.update({ where: { id: lodgeId }, data: { lat: null, lng: null, geocodedAt: new Date() } });
    return null;
  }
  const result = await geocodeAddress(address, fetchImpl);
  await db.lodge.update({
    where: { id: lodgeId },
    data: { lat: result?.lat ?? null, lng: result?.lng ?? null, geocodedAt: new Date() },
  });
  return result;
}
