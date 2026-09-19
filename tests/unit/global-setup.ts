import { execSync } from "node:child_process";
import path from "node:path";

/** Applies migrations to the dedicated test database before the suite runs. */
export default function setup() {
  const url = process.env.DATABASE_URL;
  if (!url || !/tyled_test/.test(url)) {
    throw new Error(`Refusing to run tests against non-test database: ${url}`);
  }
  execSync("npx prisma migrate deploy", {
    cwd: path.resolve(__dirname, "../.."),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
