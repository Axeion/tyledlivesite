# Tyled.Live

Multi-tenant website platform for Masonic lodges. Every lodge gets a site at
`{slug}.tyled.live` for free, or on its own domain with the paid plan; the
marketing/signup site lives on the apex domain and the platform admin at `/admin`.

**Stack:** Next.js 16 (App Router, TypeScript, server actions), PostgreSQL + Prisma 7,
S3-compatible storage (MinIO in dev), Docker Compose, Caddy with on-demand TLS,
Stripe (test mode), Leaflet + OpenStreetMap, RFC 5545 recurrence.

---

## Contents

1. [Quick start (Docker Compose)](#quick-start-docker-compose)
2. [Quick start without Docker](#quick-start-without-docker)
3. [Environment variables](#environment-variables)
4. [Architecture](#architecture)
5. [Flows: signup, approval, publish](#flows-signup-approval-publish)
6. [Plans, billing and Stripe](#plans-billing-and-stripe)
7. [Custom domains and HTTPS](#custom-domains-and-https)
8. [Local HTTPS testing](#local-https-testing)
9. [Events, recurrence, iCal, map](#events-recurrence-ical-map)
10. [Security notes](#security-notes)
11. [Tests](#tests)
12. [Deploying on a VPS](#deploying-on-a-vps)
13. [Verification record](#verification-record)

---

## Quick start (Docker Compose)

```bash
cp .env.example .env            # edit PLATFORM_DOMAIN, APP_SECRET, Stripe keys
SEED_ON_MIGRATE=1 docker compose up --build
```

This starts Caddy (80/443), the web app, the background worker, Postgres and MinIO,
applies migrations and (with `SEED_ON_MIGRATE=1`) seeds two demo lodges plus a
platform admin:

| Account | Role | Where to sign in |
|---|---|---|
| `admin@tyled.live` / `$SEED_ADMIN_PASSWORD` | platform admin | `https://PLATFORM_DOMAIN/admin` |
| `secretary@demo-lodge.example` / `$SEED_LODGE_PASSWORD` | lodge admin, Demo Lodge No. 1 (free) | `https://demo-lodge.PLATFORM_DOMAIN/dashboard` |
| `editor@demo-lodge.example` / `$SEED_LODGE_PASSWORD` | lodge editor, Demo Lodge No. 1 | same |
| `secretary@harmony-lodge.example` / `$SEED_LODGE_PASSWORD` | lodge admin, Harmony Lodge No. 42 (paid, custom domain `harmonylodge.example`) | `https://harmony-lodge.PLATFORM_DOMAIN/dashboard` |

With `PLATFORM_DOMAIN=localhost` (the default) Chrome resolves `*.localhost` to
127.0.0.1 automatically, so `https://demo-lodge.localhost` works out of the box.
Caddy issues locally-trusted certificates for `localhost` names; accept the
browser warning or trust Caddy's root CA (see [Local HTTPS testing](#local-https-testing)).

## Quick start without Docker

The repository also runs with plain local processes. This is how the platform was
verified in the sandbox described in the [verification record](#verification-record).

```bash
npm install --legacy-peer-deps
cp .env.example .env               # then set PLATFORM_DOMAIN=tyled.test, PLATFORM_SCHEME=http, PLATFORM_PORT=3000
scripts/dev-db.sh start            # throwaway PostgreSQL 16 cluster in .local/pg (needs postgresql-16 installed)
npx prisma migrate deploy && npx prisma db seed
npm run dev:stack                  # mock Stripe :4242, mock Nominatim :4243, mock DNS :5353, S3 (s3rver) :4569
npm run worker                     # domain verification / geocoding loop
npm run dev                        # http://tyled.test:3000  (or: npm run build && scripts/dev-web.sh start)
```

Add hostnames to `/etc/hosts` so subdomains resolve:

```
127.0.0.1 tyled.test demo-lodge.tyled.test harmony-lodge.tyled.test lodge.example.test
```

Point `.env` at the mocks (`STRIPE_API_BASE=http://127.0.0.1:4242`,
`NOMINATIM_BASE_URL=http://127.0.0.1:4243`, `DNS_RESOLVER=127.0.0.1:5353`,
`S3_ENDPOINT=http://127.0.0.1:4569`, `S3_ACCESS_KEY=S3RVER`, `S3_SECRET_KEY=S3RVER`,
`S3_PUBLIC_URL=http://127.0.0.1:4569/tyled-uploads`). The mocks are described
in `scripts/mocks/*.ts`; each has a tiny control API used by the e2e tests.

## Environment variables

See `.env.example` for the full list with comments. The important ones:

| Variable | Purpose |
|---|---|
| `PLATFORM_DOMAIN` | Apex domain (`tyled.live`). Lodges live on `{slug}.PLATFORM_DOMAIN`. |
| `PLATFORM_SCHEME`, `PLATFORM_PORT` | Used when building absolute URLs (https / empty in production). |
| `APP_SECRET` | Random secret. |
| `TRUST_PROXY` | `1` behind Caddy so `X-Forwarded-For` is trusted for signup rate limiting. |
| `DATABASE_URL` | Postgres connection string. |
| `S3_*` | S3-compatible storage (MinIO). `S3_PUBLIC_URL` must be reachable by browsers; the bucket allows anonymous GET (see `minio-init` in compose). |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` | Stripe test-mode keys and the recurring price for the custom-domain plan. |
| `STRIPE_API_BASE` | Optional. Points the Stripe SDK at another host (the local mock). Leave empty for real Stripe. |
| `NOMINATIM_BASE_URL`, `NOMINATIM_USER_AGENT` | Geocoder; Nominatim's policy requires an identifying User-Agent and ≤1 req/s (enforced in `lib/geocode.ts`). |
| `DNS_RESOLVER` | Optional `host:port` resolver override for domain verification (mock DNS in tests). |
| `DOMAIN_VERIFY_INTERVAL_SECONDS` | Worker interval for DNS checks (default 60). |
| `PLATFORM_IPS` | Optional comma-separated public IPs of the platform; when set, apex custom domains are told to create A records and verification checks them. |
| `SMTP_URL`, `MAIL_FROM`, `ADMIN_NOTIFY_EMAILS` | Optional email delivery; without `SMTP_URL` mail is logged. |
| `SEED_*` | Credentials created by `prisma db seed`. |
| `ACME_EMAIL` | Let's Encrypt contact for Caddy (compose). |

## Architecture

```
app/(marketing)     apex: landing, /pricing, /login, /signup (5-step wizard)
app/admin           apex: platform admin (approval queue, lodges, domains)
app/dashboard       lodge subdomain: lodge admin/editor UI
app/tenant/[host]   public lodge site, reached only through the proxy rewrite
app/api             /api/stripe/webhook, /api/internal/tls/ask, /api/health
proxy.ts            Host header -> apex | {slug}.PLATFORM_DOMAIN | custom domain routing
lib/tenant.ts       resolves the lodge for a host (custom domains need VERIFIED + entitlement)
lib/tenant-db.ts    tenant-scoped Prisma client: lodgeId enforced on every query
lib/entitlements.ts canUseCustomDomain / canUseTemplate / effectivePlan (single source of truth)
lib/billing/        Stripe client, checkout, portal, idempotent webhook handler
lib/domains/        DNS instructions, verification, Caddy "ask" decision
lib/events/         RRULE presets, timezone-correct expansion, month grid, iCal
templates/          3 free themes sharing one LodgeSiteData schema
scripts/worker.ts   background loop: DNS verification, geocoding, housekeeping
scripts/mocks/      Stripe, Nominatim, DNS, S3 stand-ins for offline development
```

**Tenancy.** One shared database; every tenant table carries `lodgeId`. The
proxy classifies the `Host` header and rewrites lodge traffic to
`/tenant/{host}/...`; `lib/tenant.ts` maps the host to a lodge. Dashboard and
public-site code only ever receive `tenantDb(lodgeId)` (`lib/tenant-db.ts`), a
Prisma client extension that injects `lodgeId` into every `where`/`data`, rejects
foreign `lodgeId` values, restricts the `Lodge` model to the tenant's own row and
blocks raw SQL. A unit test asserts every model in the schema with a `lodgeId`
column is covered. Sessions are host-scoped cookies, so a login on one lodge's
subdomain never applies to another; signup on the apex hands the user to their
subdomain with a one-time token.

**Roles.** `platformRole = PLATFORM_ADMIN` on a user; `LodgeMembership.role` is
`ADMIN` or `EDITOR`. Editors manage content, officers, events, pages and photos.
Admins additionally manage template, custom domain, billing, members and publishing.
Anyone signed in changes their own password under **Account** (`/dashboard/account`,
`/admin/account`); doing so revokes every other session for that user.

**Platform admin edits.** `/admin/lodges/{id}/edit` lets the platform admin change
any lodge's information, logo/seal and template on the lodge's behalf, through the
same validation as the dashboard. The admin may set a template above the lodge's
plan. Each save is audited with `by: "platform-admin"` so the lodge can tell it from
its own activity.

**Templates.** `templates/registry.ts` lists `classic`, `modern` and `minimal`
(all `tier: "free"`). Every template renders the same `LodgeSiteData`, so switching
changes only `lodge.templateId`. `canUseTemplate()` rejects `premium` templates
unless the plan grants them; the signup wizard, template page and server action all
go through it.

## Flows: signup, approval, publish

1. `/signup`: account → template (premium ones disabled) → lodge details (name,
   number, jurisdiction, address, contact, meeting schedule, timezone, subdomain
   with live availability check) → preview of the home page in the chosen template
   → submit. Rate-limited to 5 signups per IP per hour (DB-backed, works across
   replicas).
2. The lodge is created as `PENDING_REVIEW`, unpublished. The user is signed in on
   `{slug}.PLATFORM_DOMAIN/dashboard` and can keep editing; visitors see a
   "coming soon" page.
3. `/admin` shows the approval queue. Approve → `APPROVED` + published, and the
   worker geocodes the address. Reject (with reason) → the lodge sees the reason on
   its dashboard and can resubmit.
4. Lodge admins can unpublish/publish an approved site at any time.

## Plans, billing and Stripe

| Plan | Subdomain | Custom domain | Premium templates |
|---|---|---|---|
| FREE | yes | no | no |
| PAID (Stripe subscription) | yes | yes | yes (none shipped yet) |

`lib/entitlements.ts` is the only place that knows this table. `effectivePlan()`
downgrades a lodge whose subscription is `canceled` / `unpaid` /
`incomplete(_expired)`, or `past_due` for longer than a 7-day grace period, even if
a webhook was missed.

Dashboard → Billing → **Upgrade with Stripe** creates a Checkout Session
(`mode: subscription`, `client_reference_id` and `metadata.lodgeId` set). The
webhook at `/api/stripe/webhook` verifies the signature, records each event id
(idempotent) and applies `checkout.session.completed`,
`customer.subscription.created|updated|deleted|paused|resumed` and
`invoice.payment_failed` to `lodge.plan`, `subscriptionStatus`, `currentPeriodEnd`.
**Manage subscription** opens the customer portal.

When a subscription lapses the lodge drops to FREE: its custom domain stops
resolving (requests are redirected to the free subdomain), Caddy is refused new
certificates for it, and the site itself stays online. Domains are kept in the
database so re-subscribing restores them instantly.

### Real Stripe test mode

1. Create a recurring Price in the Stripe test dashboard and set `STRIPE_PRICE_ID`.
2. Set `STRIPE_SECRET_KEY` (`sk_test_…`) and leave `STRIPE_API_BASE` empty.
3. Forward webhooks locally: `stripe listen --forward-to https://PLATFORM_DOMAIN/api/stripe/webhook`
   and copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`. In production, add
   the endpoint in the Stripe dashboard with the events listed above.
4. Use card `4242 4242 4242 4242` in Checkout; cancel from the portal or the
   Stripe dashboard to exercise the lapse path.

### Mock Stripe (offline)

`scripts/mocks/stripe.ts` implements the endpoints the app uses and posts signed
webhooks to the app. It serves a hosted "Checkout" page with a Pay button and a
"Billing portal" page with Cancel. Control API:
`POST /__mock/subscriptions/:id/status {"status":"canceled"}` and `GET /__mock/state`.

## Custom domains and HTTPS

Dashboard → Custom domain (paid plan only):

1. Enter `www.yourlodge.org`. The app shows the records to create:
   `TXT _tyled-verify.www.yourlodge.org = tyled-verify=<token>` and
   `CNAME www.yourlodge.org → {slug}.PLATFORM_DOMAIN` (apex domains: `A` records
   when `PLATFORM_IPS` is set, otherwise ALIAS/CNAME-flattening advice).
2. `scripts/worker.ts` checks every `DOMAIN_VERIFY_INTERVAL_SECONDS` (also on
   "Check now"). A domain is `VERIFIED` when the TXT token matches **and** the name
   routes to the platform. A verified domain that has clearly lost its records on
   three consecutive checks is marked `FAILED` and stops serving; resolver errors
   (timeouts, SERVFAIL) never count against it.
3. Caddy's catch-all `https://` site uses `tls { on_demand }` with
   `on_demand_tls { ask http://web:3000/api/internal/tls/ask }`. The ask endpoint
   returns 200 only for the apex, existing lodge subdomains and `VERIFIED` custom
   domains whose lodge currently holds the custom-domain entitlement; otherwise 403
   and Caddy never obtains a certificate. The Caddyfile answers 404 for
   `/api/internal/*` from the outside, so only Caddy itself can reach it.

## Local HTTPS testing

`deploy/Caddyfile.local` uses Caddy's internal CA with the same on-demand/ask logic
as production, so you can verify the whole chain without public DNS:

```bash
apt-get install caddy                                   # or brew install caddy
echo "127.0.0.1 tyled.test demo-lodge.tyled.test harmonylodge.example evil.example.test" >> /etc/hosts
# app running on :3000, mock DNS + worker running, harmonylodge.example VERIFIED (seeded; add its
# TXT/CNAME records to the mock DNS so the worker keeps it verified):
PLATFORM_DOMAIN=tyled.test APP_UPSTREAM=127.0.0.1:3000 XDG_DATA_HOME=$PWD/.local/caddy \
  caddy run --config deploy/Caddyfile.local --adapter caddyfile
CA=.local/caddy/caddy/pki/authorities/local/root.crt
curl --cacert $CA https://harmonylodge.example/      # 200, certificate issued on demand
curl --cacert $CA https://demo-lodge.tyled.test/     # 200
curl --cacert $CA https://evil.example.test/         # TLS handshake fails: ask endpoint said 403
```

Add records to the mock DNS with
`curl -X POST http://127.0.0.1:5354/records -d '{"name":"_tyled-verify.harmonylodge.example","type":"TXT","value":"tyled-verify=<token>"}'`
(the token is on the dashboard's Custom domain page or in the `Domain` table).

## Events, recurrence, iCal, map

- Events store an RFC 5545 `RRULE` body (`FREQ=MONTHLY;BYDAY=2TU` for "2nd Tuesday
  monthly"), a start instant, optional end, `until` and `exdates`. The dashboard
  form offers presets (weekly on days, Nth weekday monthly, day-of-month monthly,
  yearly) and a custom RRULE field; rules are validated (`DAILY..YEARLY` only, no
  embedded `DTSTART/UNTIL`).
- Expansion (`lib/events/recurrence.ts`) happens in the lodge's IANA timezone, so a
  7:30 PM meeting stays at 7:30 PM across daylight-saving changes.
- Public site: `/events` (upcoming list), `/events/calendar?month=YYYY-MM` (month
  grid), `/calendar.ics` (iCal feed with `RRULE` and `TZID`, generated by
  `lib/events/ical.ts`).
- Map: `templates/shared/LodgeMap.tsx` (react-leaflet, OpenStreetMap tiles, no API
  key). The worker geocodes addresses through Nominatim with a persistent cache
  (`GeocodeCache`) and a 1 req/s limiter; results land in `lodge.lat/lng`.

## Email notifications

`lib/mailer.ts` sends plain-text mail when a lodge is submitted (to the submitter and
to `ADMIN_NOTIFY_EMAILS`), approved or rejected (to the lodge's admins). With
`SMTP_URL` unset the messages are printed to the server log, which is what the
sandbox verification used; set `SMTP_URL=smtp://user:pass@host:587` and `MAIL_FROM`
to deliver them.

## Security notes

- Tenant isolation lives in the data layer (`lib/tenant-db.ts`), not the UI.
- Every server action validates input with zod and checks the caller's role.
- Rich text (about, pages) passes through `sanitize-html` with a strict allowlist;
  plain fields are stripped of tags/control characters.
- Uploads: max 5 MB, type detected from magic bytes (PNG/JPEG/WebP only; SVG is
  rejected), random object keys under `lodges/{lodgeId}/…`.
- Rate limits (DB-backed, so they hold across replicas): 5 signups per IP per hour;
  failed logins locked after 10 per email or 30 per IP within 15 minutes. A wrong
  current password on the change-password form counts as a failed login, so a
  stolen session cannot be used to guess the password.
  `X-Forwarded-For` is only trusted with `TRUST_PROXY=1`.
- Sessions: httpOnly, SameSite=Lax, Secure in production, host-scoped, 30 days;
  one-time login tokens expire after 5 minutes.
- Stripe webhooks are signature-verified and idempotent.
- `/api/internal/tls/ask` should not be exposed publicly (compose keeps it on the
  internal network; it only answers yes/no).

## Tests

`.github/workflows/ci.yml` runs typecheck, lint, the unit suite (against a Postgres
service) and a production build on every push.

```bash
npm run typecheck && npm run lint
npm test                 # vitest: tenant isolation (real Postgres, tyled_test DB), entitlements,
                         # recurrence/timezone/iCal, sanitize, uploads, domains + TLS ask, Stripe
                         # webhooks, rate limit, tenant resolution
npm run test:e2e         # Playwright against a running local stack (see "Quick start without Docker")
```

The e2e suite covers: full signup wizard → pending → admin approval → live site
(with map after geocoding) → unpublish/publish → reject/resubmit; editor vs admin
permissions; cross-lodge login and cross-tenant ids returning 404; template switch
keeping content; recurring event creation → site, month grid and iCal; Stripe
Checkout upgrade via webhook → custom domain verification through the worker →
serving on the custom domain and TLS ask approval → lapse → fallback redirect and
ask refusal → re-subscribe and portal cancel; image upload acceptance and rejection.

## Deploying on a VPS

1. **DNS.** `A` records for `tyled.live` and `*.tyled.live` → the VPS IP. Set
   `PLATFORM_IPS=<ip>` so apex custom domains get correct A-record instructions.
2. **Server.** Ubuntu 22.04/24.04 with Docker Engine + Compose plugin. Open ports
   80, 443 (TCP and UDP for HTTP/3).
3. **Configure.** `git clone … && cd tyledlivesite && cp .env.example .env`, then set
   `PLATFORM_DOMAIN=tyled.live`, `PLATFORM_SCHEME=https`, `PLATFORM_PORT=` (empty),
   `TRUST_PROXY=1`, a strong `APP_SECRET`, `POSTGRES_PASSWORD`, `S3_SECRET_KEY`,
   `S3_PUBLIC_URL=https://tyled.live/…` *or* a public MinIO hostname (see below),
   Stripe live/test keys, `ACME_EMAIL`, and the seed passwords.
4. **Object storage.** MinIO images are pulled from Quay (`quay.io/minio/minio`, `quay.io/minio/mc`);
   the old Docker Hub `minio/minio` repository no longer exists. Any S3-compatible store works
   instead: drop the `minio` and `minio-init` services and point the `S3_*` variables at it.
   Browsers load images straight from `S3_PUBLIC_URL`. Either
   expose MinIO behind Caddy on `files.tyled.live` (add a site block that
   `reverse_proxy minio:9000`) and set `S3_PUBLIC_URL=https://files.tyled.live/tyled-uploads`,
   or use any S3-compatible provider and drop the `minio` services.
5. **Run.** `SEED_ON_MIGRATE=1 docker compose up -d --build` the first time (creates the
   platform admin), then `docker compose up -d --build` for updates. Migrations run
   automatically via the `migrate` service.
6. **Stripe.** Add the webhook endpoint `https://tyled.live/api/stripe/webhook` in the
   Stripe dashboard and set `STRIPE_WEBHOOK_SECRET` from it.
7. **Caddy** obtains certificates on demand: wildcard subdomains and verified custom
   domains get a certificate on their first HTTPS request. Rate limits for on-demand
   issuance are set in `deploy/Caddyfile` (`interval`/`burst`).
8. **Backups.** Postgres volume `pg_data` and MinIO volume `minio_data`.
9. **Health.** `GET https://tyled.live/api/health` returns database status and host classification.

## Verification record

Built and verified in a sandbox without Docker, without outbound access to Stripe,
Nominatim, OpenStreetMap tiles or MinIO downloads. What was verified end to end and how:

| Requirement | How it was verified |
|---|---|
| Seed: two demo lodges on separate subdomains + platform admin | `prisma db seed`; `http://demo-lodge.tyled.test:3000` (classic) and `http://harmony-lodge.tyled.test:3000` (modern) render with officers, events, pages; admin can sign in at `/admin` |
| Signup → approval → publish | Playwright `tests/e2e/signup-approval.spec.ts` |
| Custom domain verified and served over HTTPS | Mock DNS + worker verify `harmonylodge.example`; Caddy 2.6.2 with `deploy/Caddyfile.local` (internal CA) issued certificates on demand and served the lodge site over HTTPS; `evil.example.test` was refused at the TLS handshake because the ask endpoint returned 403 |
| Stripe upgrade and lapse fallback | Playwright `tests/e2e/billing-domain.spec.ts` against the mock Stripe server (real Checkout/Portal/webhook wire format, signed webhooks). The real Stripe API could not be reached from the sandbox; use the steps under "Real Stripe test mode" |
| Tenant isolation, entitlements, recurrence tests | `npm test` (vitest, 65 tests, real Postgres) |
| Map | Geocoding via the mock Nominatim; the Leaflet map mounts with the coordinates. OSM tiles could not load in the sandbox, so tile rendering itself is unverified there |
| Docker Compose / Dockerfile | Written to match the local process layout but could not be built or run in the sandbox (no Docker daemon) |
