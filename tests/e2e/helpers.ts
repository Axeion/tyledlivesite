import { expect, type Page } from "@playwright/test";
import { Pool } from "pg";

export const DOMAIN = process.env.PLATFORM_DOMAIN ?? "tyled.test";
export const PORT = process.env.PLATFORM_PORT ?? "3000";
export const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@tyled.live";
export const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin-password-change-me";
export const LODGE_PASSWORD = process.env.SEED_LODGE_PASSWORD ?? "lodge-password-change-me";
export const MOCK_STRIPE = process.env.STRIPE_API_BASE ?? "http://127.0.0.1:4242";
export const MOCK_DNS_CONTROL = `http://127.0.0.1:${process.env.MOCK_DNS_CONTROL_PORT ?? 5354}`;

export const apex = (path = "/") => `http://${DOMAIN}:${PORT}${path}`;
export const sub = (slug: string, path = "/") => `http://${slug}.${DOMAIN}:${PORT}${path}`;

// ---------------------------------------------------------------------------
// Direct database access for setup/assertions (plain SQL keeps the e2e runner
// independent of the generated Prisma client's module format).
// ---------------------------------------------------------------------------
let pool: Pool | null = null;
function pg(): Pool {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}

export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pg().query(text, params);
  return res.rows as T[];
}

export interface LodgeRow {
  id: string;
  slug: string;
  status: string;
  published: boolean;
  plan: string;
  templateId: string;
  about: string | null;
  lat: number | null;
  lng: number | null;
  logoKey: string | null;
  subscriptionStatus: string | null;
  stripeSubscriptionId: string | null;
}

export async function lodge(slug: string): Promise<LodgeRow> {
  const rows = await sql<LodgeRow>('SELECT * FROM "Lodge" WHERE slug = $1', [slug]);
  if (!rows[0]) throw new Error(`lodge ${slug} not found`);
  return rows[0];
}

export async function updateLodge(slug: string, patch: Record<string, unknown>): Promise<void> {
  const keys = Object.keys(patch);
  const sets = keys.map((k, i) => `"${k}" = $${i + 2}`).join(", ");
  await sql(`UPDATE "Lodge" SET ${sets} WHERE slug = $1`, [slug, ...keys.map((k) => patch[k])]);
}

export async function count(table: string, where = "TRUE", params: unknown[] = []): Promise<number> {
  const rows = await sql<{ n: string }>(`SELECT COUNT(*)::text AS n FROM "${table}" WHERE ${where}`, params);
  return Number(rows[0].n);
}

export async function firstIdForLodge(table: string, slug: string): Promise<string> {
  const rows = await sql<{ id: string }>(
    `SELECT t.id FROM "${table}" t JOIN "Lodge" l ON l.id = t."lodgeId" WHERE l.slug = $1 ORDER BY t."createdAt" LIMIT 1`,
    [slug],
  );
  if (!rows[0]) throw new Error(`no ${table} rows for ${slug}`);
  return rows[0].id;
}

export async function loginDashboard(page: Page, slug: string, email: string, password = LODGE_PASSWORD) {
  await page.goto(sub(slug, "/dashboard/login"));
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(new RegExp(`${slug}\\.${DOMAIN.replace(".", "\\.")}:${PORT}/dashboard$`));
}

export async function loginAdmin(page: Page) {
  await page.goto(apex("/admin/login"));
  await page.fill("#email", ADMIN_EMAIL);
  await page.fill("#password", ADMIN_PASSWORD);
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/admin$/);
}

export async function addDnsRecord(name: string, type: "A" | "CNAME" | "TXT", value: string) {
  const res = await fetch(`${MOCK_DNS_CONTROL}/records`, { method: "POST", body: JSON.stringify({ name, type, value }) });
  if (!res.ok) throw new Error(`mock dns: ${res.status}`);
}

export async function clearDnsRecords(name?: string) {
  await fetch(`${MOCK_DNS_CONTROL}/records${name ? `?name=${encodeURIComponent(name)}` : ""}`, { method: "DELETE" });
}

export async function mockStripeState(): Promise<{ subscriptions: { id: string; customer: string; status: string }[] }> {
  const res = await fetch(`${MOCK_STRIPE}/__mock/state`);
  return res.json();
}

export async function mockStripeSetStatus(subscriptionId: string, status: string) {
  const res = await fetch(`${MOCK_STRIPE}/__mock/subscriptions/${subscriptionId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`mock stripe: ${res.status}`);
}

export async function waitFor<T>(fn: () => Promise<T>, pred: (v: T) => boolean, timeoutMs = 30_000, every = 500): Promise<T> {
  const start = Date.now();
  let last: T;
  do {
    last = await fn();
    if (pred(last)) return last;
    await new Promise((r) => setTimeout(r, every));
  } while (Date.now() - start < timeoutMs);
  throw new Error(`waitFor timed out; last value: ${JSON.stringify(last)}`);
}

export async function httpStatus(url: string): Promise<{ status: number; location: string | null; body: string }> {
  const res = await fetch(url, { redirect: "manual" });
  return { status: res.status, location: res.headers.get("location"), body: await res.text() };
}

/** 1x1 PNG used for upload tests. */
export const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
