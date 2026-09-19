/**
 * Central place for reading environment configuration. Everything else imports
 * from here so defaults and parsing live in one file.
 */

function str(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable ${name}`);
  }
  return v;
}

function bool(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  get platformDomain() {
    return str("PLATFORM_DOMAIN", "localhost").toLowerCase();
  },
  get platformScheme() {
    return str("PLATFORM_SCHEME", "https");
  },
  get platformPort() {
    return process.env.PLATFORM_PORT ?? "";
  },
  get trustProxy() {
    return bool("TRUST_PROXY", false);
  },
  get appSecret() {
    return str("APP_SECRET", "dev-only-insecure-secret");
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get databaseUrl() {
    return str("DATABASE_URL");
  },
  s3: {
    get endpoint() {
      return str("S3_ENDPOINT", "http://localhost:9000");
    },
    get region() {
      return str("S3_REGION", "us-east-1");
    },
    get bucket() {
      return str("S3_BUCKET", "tyled-uploads");
    },
    get accessKey() {
      return str("S3_ACCESS_KEY", "minioadmin");
    },
    get secretKey() {
      return str("S3_SECRET_KEY", "minioadmin");
    },
    get publicUrl() {
      return str("S3_PUBLIC_URL", "http://localhost:9000/tyled-uploads").replace(/\/$/, "");
    },
    get forcePathStyle() {
      return bool("S3_FORCE_PATH_STYLE", true);
    },
  },
  stripe: {
    get secretKey() {
      return str("STRIPE_SECRET_KEY", "sk_test_missing");
    },
    get webhookSecret() {
      return str("STRIPE_WEBHOOK_SECRET", "whsec_missing");
    },
    get priceId() {
      return str("STRIPE_PRICE_ID", "price_missing");
    },
    get apiBase() {
      return process.env.STRIPE_API_BASE ?? "";
    },
  },
  nominatim: {
    get baseUrl() {
      return str("NOMINATIM_BASE_URL", "https://nominatim.openstreetmap.org").replace(/\/$/, "");
    },
    get userAgent() {
      return str("NOMINATIM_USER_AGENT", "tyled.live/0.1 (contact@tyled.live)");
    },
  },
  domains: {
    get dnsResolver() {
      return process.env.DNS_RESOLVER ?? "";
    },
    get verifyIntervalSeconds() {
      return int("DOMAIN_VERIFY_INTERVAL_SECONDS", 60);
    },
  },
  signup: {
    get maxPerHour() {
      return int("SIGNUP_MAX_PER_HOUR", 5);
    },
  },
};
