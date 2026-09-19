import { describe, expect, it } from "vitest";
import { apexUrl, classifyHost, lodgeSubdomainUrl, normalizeHost } from "@/lib/urls";

describe("host classification", () => {
  it("strips ports and lowercases", () => {
    expect(normalizeHost("Demo-Lodge.Tyled.Test:3000")).toBe("demo-lodge.tyled.test");
    expect(normalizeHost(null)).toBe("");
  });
  it("classifies apex, subdomain, custom and invalid hosts", () => {
    expect(classifyHost("tyled.test")).toEqual({ kind: "apex" });
    expect(classifyHost("www.tyled.test")).toEqual({ kind: "apex" });
    expect(classifyHost("demo-lodge.tyled.test")).toEqual({ kind: "subdomain", slug: "demo-lodge" });
    expect(classifyHost("a.b.tyled.test")).toEqual({ kind: "invalid" });
    expect(classifyHost("-bad.tyled.test")).toEqual({ kind: "invalid" });
    expect(classifyHost("lodge.example.org")).toEqual({ kind: "custom", hostname: "lodge.example.org" });
    expect(classifyHost("localhost")).toEqual({ kind: "invalid" });
    expect(classifyHost("")).toEqual({ kind: "invalid" });
  });
  it("builds absolute urls with dev port", () => {
    expect(apexUrl("/admin")).toBe("http://tyled.test:3000/admin");
    expect(lodgeSubdomainUrl("demo-lodge", "/events")).toBe("http://demo-lodge.tyled.test:3000/events");
  });
});
