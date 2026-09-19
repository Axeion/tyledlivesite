/**
 * Tiny authoritative DNS server (UDP) used to exercise custom-domain
 * verification locally. Records are managed over a small HTTP control API:
 *   POST /records {"name":"_tyled-verify.lodge.example.test","type":"TXT","value":"tyled-verify=..."}
 *   DELETE /records?name=...
 *   GET /records
 * Point the app at it with DNS_RESOLVER=127.0.0.1:5353.
 */
import { createServer } from "node:http";
import { createSocket } from "node:dgram";
import dnsPacket, { type Answer, type Question } from "dns-packet";

export interface DnsRecord {
  name: string;
  type: "A" | "CNAME" | "TXT";
  value: string;
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => resolve(d));
  });
}

export function startMockDns(opts: { udpPort?: number; httpPort?: number } = {}) {
  const udpPort = opts.udpPort ?? Number(process.env.MOCK_DNS_PORT ?? 5353);
  const httpPort = opts.httpPort ?? Number(process.env.MOCK_DNS_CONTROL_PORT ?? 5354);
  const records: DnsRecord[] = [];

  const socket = createSocket("udp4");
  socket.on("message", (msg, rinfo) => {
    let query: ReturnType<typeof dnsPacket.decode>;
    try {
      query = dnsPacket.decode(msg);
    } catch {
      return;
    }
    const question = query.questions?.[0] as Question | undefined;
    const name = (question?.name ?? "").toLowerCase();
    const type = question?.type ?? "A";
    const matches = records.filter((r) => r.name.toLowerCase() === name);
    const answers: Answer[] = matches
      .filter((r) => r.type === type)
      .map((r) => {
        if (r.type === "TXT") return { name, type: "TXT", ttl: 60, data: [r.value] } as Answer;
        if (r.type === "CNAME") return { name, type: "CNAME", ttl: 60, data: r.value } as Answer;
        return { name, type: "A", ttl: 60, data: r.value } as Answer;
      });
    // NXDOMAIN when the name has no records at all; NOERROR/empty when it has other types.
    const rcode = matches.length === 0 ? 3 : 0;
    const response = dnsPacket.encode({
      id: query.id,
      type: "response",
      flags: dnsPacket.RECURSION_DESIRED | dnsPacket.RECURSION_AVAILABLE | dnsPacket.AUTHORITATIVE_ANSWER | rcode,
      questions: query.questions,
      answers,
    });
    socket.send(response, rinfo.port, rinfo.address);
  });
  socket.bind(udpPort, "127.0.0.1", () => console.log(`[mock-dns] udp listening on 127.0.0.1:${udpPort}`));

  const control = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${httpPort}`);
    res.setHeader("Content-Type", "application/json");
    if (url.pathname !== "/records") {
      res.writeHead(404);
      return res.end("{}");
    }
    if (req.method === "GET") return res.end(JSON.stringify(records));
    if (req.method === "POST") {
      const rec = JSON.parse((await readBody(req)) || "{}") as DnsRecord;
      if (!rec.name || !rec.type || rec.value === undefined) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: "name, type, value required" }));
      }
      records.push({ name: rec.name.toLowerCase().replace(/\.$/, ""), type: rec.type, value: rec.value });
      return res.end(JSON.stringify({ ok: true, count: records.length }));
    }
    if (req.method === "DELETE") {
      const name = (url.searchParams.get("name") ?? "").toLowerCase();
      for (let i = records.length - 1; i >= 0; i--) {
        if (!name || records[i].name === name) records.splice(i, 1);
      }
      return res.end(JSON.stringify({ ok: true, count: records.length }));
    }
    res.writeHead(405);
    res.end("{}");
  });
  control.listen(httpPort, "127.0.0.1", () => console.log(`[mock-dns] control api on http://127.0.0.1:${httpPort}/records`));
  return { socket, control, records, udpPort, httpPort };
}

if (process.argv[1] && /mocks[\\/]dns\.ts$/.test(process.argv[1])) {
  startMockDns();
}
