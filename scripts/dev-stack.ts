/**
 * Starts every local stand-in service in one process:
 *   mock Stripe     http://127.0.0.1:4242
 *   mock Nominatim  http://127.0.0.1:4243
 *   mock DNS        udp 127.0.0.1:5353 (control http://127.0.0.1:5354)
 *   S3 (s3rver)     http://127.0.0.1:4569
 * Use together with `scripts/dev-db.sh start`, `npm run dev` and `npm run worker`
 * when Docker Compose is not an option. Ports are configurable via MOCK_*_PORT.
 */
import "dotenv/config";
import { startMockDns } from "./mocks/dns";
import { startMockNominatim } from "./mocks/nominatim";
import { startMockS3 } from "./mocks/s3";
import { startMockStripe } from "./mocks/stripe";

async function main() {
  startMockStripe();
  startMockNominatim();
  startMockDns();
  await startMockS3();
  console.log("[dev-stack] all mock services up. Ctrl+C to stop.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
