import { config as loadEnv } from "dotenv";
import path from "node:path";
import { defineConfig } from "vitest/config";

loadEnv({ path: path.resolve(import.meta.dirname, ".env") });

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  (process.env.DATABASE_URL ?? "postgresql://tyled:tyled@127.0.0.1:5432/tyled").replace(/\/[^/?]+(\?|$)/, "/tyled_test$1");

// Apply to the main process too so globalSetup (migrations) targets the test DB.
process.env.DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    globalSetup: ["tests/unit/global-setup.ts"],
    env: {
      DATABASE_URL: testDatabaseUrl,
      PLATFORM_DOMAIN: "tyled.test",
      PLATFORM_SCHEME: "http",
      PLATFORM_PORT: "3000",
      APP_SECRET: "test-secret",
      STRIPE_SECRET_KEY: "sk_test_unit",
      STRIPE_WEBHOOK_SECRET: "whsec_unit_test",
      STRIPE_PRICE_ID: "price_unit",
      SIGNUP_MAX_PER_HOUR: "5",
    },
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
