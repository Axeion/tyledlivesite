/**
 * Local Nominatim stand-in. Returns deterministic coordinates for any query
 * (derived from a hash of the query) and a few well-known demo addresses, so
 * the map flow can be exercised without network access.
 */
import { createHash } from "node:crypto";
import { createServer } from "node:http";

const KNOWN: Record<string, { lat: number; lon: number; display_name: string }> = {
  "100 main street, springfield, il, 62701, us": { lat: 39.7817, lon: -89.6501, display_name: "100 Main Street, Springfield, IL 62701, USA" },
  "42 temple avenue, chicago, il, 60601, us": { lat: 41.8853, lon: -87.6229, display_name: "42 Temple Avenue, Chicago, IL 60601, USA" },
};

export function startMockNominatim(port = Number(process.env.MOCK_NOMINATIM_PORT ?? 4243)) {
  const requests: { q: string; userAgent: string; at: number }[] = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    if (url.pathname === "/__mock/requests") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(requests));
    }
    if (url.pathname !== "/search") {
      res.writeHead(404);
      return res.end("not found");
    }
    const q = (url.searchParams.get("q") ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    requests.push({ q, userAgent: String(req.headers["user-agent"] ?? ""), at: Date.now() });
    if (!req.headers["user-agent"]) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "User-Agent required" }));
    }
    if (q.includes("nowhere")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end("[]");
    }
    const known = KNOWN[q];
    let hit;
    if (known) {
      hit = known;
    } else {
      const h = createHash("sha256").update(q).digest();
      hit = {
        lat: 25 + (h.readUInt16BE(0) / 65535) * 24, // somewhere over the continental US
        lon: -124 + (h.readUInt16BE(2) / 65535) * 57,
        display_name: q.replace(/\b\w/g, (c) => c.toUpperCase()),
      };
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([{ place_id: 1, lat: String(hit.lat), lon: String(hit.lon), display_name: hit.display_name }]));
  });
  server.listen(port, "127.0.0.1", () => console.log(`[mock-nominatim] listening on http://127.0.0.1:${port}`));
  return { server, requests, port };
}

if (process.argv[1] && /mocks[\\/]nominatim\.ts$/.test(process.argv[1])) {
  startMockNominatim();
}
