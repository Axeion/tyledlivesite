import { config as loadEnv } from "dotenv";
import { defineConfig } from "@playwright/test";

loadEnv();

const domain = process.env.PLATFORM_DOMAIN ?? "tyled.test";
const port = process.env.PLATFORM_PORT ?? "3000";

/**
 * End-to-end tests run against an already-running stack:
 *   scripts/dev-db.sh start && npm run dev:stack & npm run worker & npm start
 * plus /etc/hosts entries for {domain} and the lodge subdomains (see README).
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://${domain}:${port}`,
    trace: "retain-on-failure",
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
      },
    },
  ],
});
