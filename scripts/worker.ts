/**
 * Background worker. Runs alongside the web app (separate container in
 * docker-compose) and performs:
 *   - custom domain DNS verification (every DOMAIN_VERIFY_INTERVAL_SECONDS)
 *   - geocoding of lodges whose address changed (every 30s)
 *   - housekeeping: expired sessions/login tokens, old signup attempts (hourly)
 */
import "dotenv/config";
import { db } from "../lib/db";
import { runDomainVerificationPass } from "../lib/domains/service";
import { env } from "../lib/env";
import { geocodeLodge } from "../lib/geocode";
import { pruneSignupAttempts } from "../lib/rate-limit";

function loop(name: string, intervalMs: number, fn: () => Promise<void>) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (err) {
      console.error(`[worker:${name}]`, err);
    } finally {
      running = false;
    }
  };
  void tick();
  return setInterval(tick, intervalMs);
}

export async function geocodePendingLodges(): Promise<number> {
  const pending = await db.lodge.findMany({
    where: { geocodedAt: null, OR: [{ addressLine1: { not: null } }, { city: { not: null } }] },
    select: { id: true, slug: true },
    take: 20,
  });
  for (const lodge of pending) {
    try {
      const r = await geocodeLodge(lodge.id);
      console.log(`[worker:geocode] ${lodge.slug} -> ${r ? `${r.lat},${r.lng}` : "not found"}`);
    } catch (err) {
      console.error(`[worker:geocode] ${lodge.slug} failed:`, err);
      // Mark as attempted so one bad address cannot block the queue forever; retried after an hour.
      await db.lodge.update({ where: { id: lodge.id }, data: { geocodedAt: new Date(Date.now() - 23 * 3600 * 1000) } });
    }
  }
  return pending.length;
}

export async function housekeeping(): Promise<void> {
  const now = new Date();
  const sessions = await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  const tokens = await db.loginToken.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] } });
  const attempts = await pruneSignupAttempts();
  console.log(`[worker:housekeeping] sessions=${sessions.count} tokens=${tokens.count} signupAttempts=${attempts}`);
}

function main() {
  const timers = [
    loop("domains", env.domains.verifyIntervalSeconds * 1000, async () => {
      const r = await runDomainVerificationPass();
      if (r.checked > 0) console.log(`[worker:domains] checked=${r.checked} newlyVerified=${r.verified}`);
    }),
    loop("geocode", 30_000, async () => {
      await geocodePendingLodges();
    }),
    loop("housekeeping", 60 * 60 * 1000, housekeeping),
  ];
  console.log(`[worker] started (domain check every ${env.domains.verifyIntervalSeconds}s)`);
  const stop = () => {
    timers.forEach(clearInterval);
    db.$disconnect().finally(() => process.exit(0));
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

if (process.argv[1] && /worker\.ts$/.test(process.argv[1])) {
  main();
}
