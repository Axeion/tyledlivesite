import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../lib/auth/password";
import { randomToken } from "../lib/auth/tokens";
import { sanitizeRichText } from "../lib/sanitize";

/**
 * Seeds a platform admin and two demo lodges on separate subdomains.
 *   admin@tyled.live                 platform admin
 *   secretary@demo-lodge.example     lodge admin of demo-lodge (FREE plan)
 *   editor@demo-lodge.example        lodge editor of demo-lodge
 *   secretary@harmony-lodge.example  lodge admin of harmony-lodge (PAID plan, verified custom domain)
 * Passwords come from SEED_ADMIN_PASSWORD / SEED_LODGE_PASSWORD.
 */
async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@tyled.live";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin-password-change-me";
  const lodgePassword = process.env.SEED_LODGE_PASSWORD ?? "lodge-password-change-me";
  const customDomain = process.env.SEED_CUSTOM_DOMAIN ?? "harmonylodge.example";

  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: { platformRole: "PLATFORM_ADMIN", passwordHash: await hashPassword(adminPassword) },
    create: { email: adminEmail, name: "Platform Admin", platformRole: "PLATFORM_ADMIN", passwordHash: await hashPassword(adminPassword) },
  });

  // ---- Demo Lodge No. 1 (free plan) --------------------------------------
  const demo = await db.lodge.upsert({
    where: { slug: "demo-lodge" },
    update: {},
    create: {
      slug: "demo-lodge",
      name: "Demo Lodge",
      number: "1",
      jurisdiction: "Grand Lodge of Example",
      status: "APPROVED",
      published: true,
      submittedAt: new Date(),
      approvedAt: new Date(),
      plan: "FREE",
      templateId: "classic",
      timezone: "America/New_York",
      tagline: "Making good men better since 1875.",
      about: sanitizeRichText(
        "<p>Demo Lodge No. 1 is a demonstration lodge used to showcase the Tyled.Live platform. We meet on the second Tuesday of every month.</p><h3>Visitors welcome</h3><p>Brethren in good standing from recognised jurisdictions are always welcome. Please bring your dues card.</p>",
      ),
      meetingSchedule: "Stated communication: 2nd Tuesday monthly, 7:30 PM\nDinner served at 6:30 PM",
      contactEmail: "secretary@demo-lodge.example",
      contactPhone: "(555) 010-0001",
      addressLine1: "100 Main Street",
      city: "Springfield",
      region: "IL",
      postalCode: "62701",
      country: "US",
      lat: 39.7817,
      lng: -89.6501,
      geocodedAt: new Date(),
    },
  });

  const demoSecretary = await db.user.upsert({
    where: { email: "secretary@demo-lodge.example" },
    update: { passwordHash: await hashPassword(lodgePassword) },
    create: { email: "secretary@demo-lodge.example", name: "Demo Secretary", passwordHash: await hashPassword(lodgePassword) },
  });
  const demoEditor = await db.user.upsert({
    where: { email: "editor@demo-lodge.example" },
    update: { passwordHash: await hashPassword(lodgePassword) },
    create: { email: "editor@demo-lodge.example", name: "Demo Editor", passwordHash: await hashPassword(lodgePassword) },
  });
  await db.lodgeMembership.upsert({
    where: { userId_lodgeId: { userId: demoSecretary.id, lodgeId: demo.id } },
    update: { role: "ADMIN" },
    create: { userId: demoSecretary.id, lodgeId: demo.id, role: "ADMIN" },
  });
  await db.lodgeMembership.upsert({
    where: { userId_lodgeId: { userId: demoEditor.id, lodgeId: demo.id } },
    update: { role: "EDITOR" },
    create: { userId: demoEditor.id, lodgeId: demo.id, role: "EDITOR" },
  });

  await db.officer.deleteMany({ where: { lodgeId: demo.id } });
  await db.officer.createMany({
    data: [
      { lodgeId: demo.id, title: "Worshipful Master", name: "John A. Smith", order: 0 },
      { lodgeId: demo.id, title: "Senior Warden", name: "Robert Jones", order: 1 },
      { lodgeId: demo.id, title: "Junior Warden", name: "William Brown", order: 2 },
      { lodgeId: demo.id, title: "Treasurer", name: "James Wilson", order: 3 },
      { lodgeId: demo.id, title: "Secretary", name: "Thomas Taylor", order: 4 },
    ],
  });

  await db.event.deleteMany({ where: { lodgeId: demo.id } });
  await db.event.createMany({
    data: [
      {
        lodgeId: demo.id,
        title: "Stated Communication",
        description: "Regular monthly business meeting. Dinner at 6:30 PM.",
        location: "Lodge Hall, 100 Main Street",
        // 2026-01-13 19:30 America/New_York (a Tuesday)
        startsAt: new Date("2026-01-14T00:30:00.000Z"),
        endsAt: new Date("2026-01-14T02:30:00.000Z"),
        rrule: "FREQ=MONTHLY;BYDAY=2TU",
      },
      {
        lodgeId: demo.id,
        title: "Fellowship Breakfast",
        description: "Open to families and friends.",
        location: "Lodge Dining Room",
        startsAt: new Date("2026-01-03T13:00:00.000Z"),
        endsAt: new Date("2026-01-03T15:00:00.000Z"),
        rrule: "FREQ=MONTHLY;BYDAY=1SA",
      },
      {
        lodgeId: demo.id,
        title: "Installation of Officers",
        description: "Annual installation. Open ceremony; guests welcome.",
        location: "Lodge Hall",
        startsAt: new Date("2026-12-12T23:00:00.000Z"),
        endsAt: new Date("2026-12-13T01:30:00.000Z"),
      },
    ],
  });

  await db.page.deleteMany({ where: { lodgeId: demo.id } });
  await db.page.createMany({
    data: [
      {
        lodgeId: demo.id,
        slug: "history",
        title: "Our History",
        order: 0,
        bodyHtml: sanitizeRichText(
          "<p>Chartered in 1875, Demo Lodge No. 1 has met continuously for over a century.</p><ul><li>1875: Charter granted</li><li>1902: Present lodge hall built</li><li>1975: Centennial celebration</li></ul>",
        ),
      },
      {
        lodgeId: demo.id,
        slug: "membership",
        title: "Becoming a Mason",
        order: 1,
        bodyHtml: sanitizeRichText(
          "<p>To be one, ask one. If you are interested in Freemasonry, contact our Secretary and we will be glad to talk with you.</p>",
        ),
      },
    ],
  });

  // ---- Harmony Lodge No. 42 (paid plan, custom domain) -------------------
  const harmony = await db.lodge.upsert({
    where: { slug: "harmony-lodge" },
    update: {},
    create: {
      slug: "harmony-lodge",
      name: "Harmony Lodge",
      number: "42",
      jurisdiction: "Grand Lodge of Example",
      status: "APPROVED",
      published: true,
      submittedAt: new Date(),
      approvedAt: new Date(),
      plan: "PAID",
      stripeCustomerId: "cus_seed_harmony",
      stripeSubscriptionId: "sub_seed_harmony",
      subscriptionStatus: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      templateId: "modern",
      timezone: "America/Chicago",
      tagline: "Friendship, morality and brotherly love on the prairie.",
      about: sanitizeRichText("<p>Harmony Lodge No. 42 was chartered in 1901 and meets in the historic Masonic Temple downtown.</p>"),
      meetingSchedule: "Stated meeting: 1st Thursday monthly, 7:00 PM",
      contactEmail: "secretary@harmony-lodge.example",
      addressLine1: "42 Temple Avenue",
      city: "Chicago",
      region: "IL",
      postalCode: "60601",
      country: "US",
      lat: 41.8853,
      lng: -87.6229,
      geocodedAt: new Date(),
    },
  });
  const harmonySecretary = await db.user.upsert({
    where: { email: "secretary@harmony-lodge.example" },
    update: { passwordHash: await hashPassword(lodgePassword) },
    create: { email: "secretary@harmony-lodge.example", name: "Harmony Secretary", passwordHash: await hashPassword(lodgePassword) },
  });
  await db.lodgeMembership.upsert({
    where: { userId_lodgeId: { userId: harmonySecretary.id, lodgeId: harmony.id } },
    update: { role: "ADMIN" },
    create: { userId: harmonySecretary.id, lodgeId: harmony.id, role: "ADMIN" },
  });
  await db.officer.deleteMany({ where: { lodgeId: harmony.id } });
  await db.officer.createMany({
    data: [
      { lodgeId: harmony.id, title: "Worshipful Master", name: "Charles Anderson", order: 0 },
      { lodgeId: harmony.id, title: "Senior Warden", name: "Daniel Thomas", order: 1 },
      { lodgeId: harmony.id, title: "Junior Warden", name: "Edward Moore", order: 2 },
      { lodgeId: harmony.id, title: "Secretary", name: "Frank Martin", order: 3 },
    ],
  });
  await db.event.deleteMany({ where: { lodgeId: harmony.id } });
  await db.event.createMany({
    data: [
      {
        lodgeId: harmony.id,
        title: "Stated Meeting",
        location: "Masonic Temple, 42 Temple Avenue",
        // 2026-01-01 19:00 America/Chicago (a Thursday)
        startsAt: new Date("2026-01-02T01:00:00.000Z"),
        endsAt: new Date("2026-01-02T03:00:00.000Z"),
        rrule: "FREQ=MONTHLY;BYDAY=1TH",
      },
      {
        lodgeId: harmony.id,
        title: "Degree Practice",
        location: "Lodge Room",
        startsAt: new Date("2026-01-06T00:30:00.000Z"),
        endsAt: new Date("2026-01-06T02:00:00.000Z"),
        rrule: "FREQ=WEEKLY;BYDAY=MO",
      },
    ],
  });
  await db.page.deleteMany({ where: { lodgeId: harmony.id } });
  await db.page.create({
    data: {
      lodgeId: harmony.id,
      slug: "temple",
      title: "The Temple",
      order: 0,
      bodyHtml: sanitizeRichText("<p>Our 1912 temple building is on the National Register of Historic Places.</p>"),
    },
  });
  await db.domain.upsert({
    where: { hostname: customDomain },
    update: { lodgeId: harmony.id, status: "VERIFIED", verifiedAt: new Date(), lastError: null },
    create: {
      lodgeId: harmony.id,
      hostname: customDomain,
      verificationToken: randomToken(16),
      status: "VERIFIED",
      verifiedAt: new Date(),
      lastCheckedAt: new Date(),
    },
  });

  await db.auditLog.create({ data: { actorId: admin.id, action: "seed.run", meta: { lodges: ["demo-lodge", "harmony-lodge"] } } });

  console.log("Seeded:");
  console.log(`  platform admin   ${adminEmail} / ${adminPassword}`);
  console.log(`  demo-lodge       secretary@demo-lodge.example (admin), editor@demo-lodge.example (editor) / ${lodgePassword}`);
  console.log(`  harmony-lodge    secretary@harmony-lodge.example (admin) / ${lodgePassword}  custom domain: ${customDomain}`);
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
