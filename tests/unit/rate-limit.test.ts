import { beforeEach, describe, expect, it } from "vitest";
import { checkSignupRateLimit, getClientIp } from "@/lib/rate-limit";
import { resetDatabase } from "./helpers";

describe("signup rate limit", () => {
  beforeEach(resetDatabase);

  it("allows five attempts per hour per ip then blocks", async () => {
    const now = new Date("2026-01-01T12:00:00Z");
    for (let i = 0; i < 5; i++) {
      const r = await checkSignupRateLimit("203.0.113.5", now);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(4 - i);
    }
    const blocked = await checkSignupRateLimit("203.0.113.5", now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    // Other IPs are unaffected.
    expect((await checkSignupRateLimit("203.0.113.6", now)).allowed).toBe(true);
    // Window slides.
    const later = new Date(now.getTime() + 61 * 60 * 1000);
    expect((await checkSignupRateLimit("203.0.113.5", later)).allowed).toBe(true);
  });

  it("only trusts forwarded headers when TRUST_PROXY is set", () => {
    const h = new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" });
    process.env.TRUST_PROXY = "0";
    expect(getClientIp(h)).toBe("unknown");
    process.env.TRUST_PROXY = "1";
    expect(getClientIp(h)).toBe("198.51.100.1");
    process.env.TRUST_PROXY = "0";
  });
});
