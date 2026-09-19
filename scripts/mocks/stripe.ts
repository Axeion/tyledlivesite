/**
 * Minimal Stripe API stand-in for local development and end-to-end tests.
 * Implements just the endpoints the app uses (customers, checkout sessions,
 * subscriptions, billing portal) and delivers signed webhooks to the app the
 * same way Stripe would. Not a full emulator; use real Stripe test mode + the
 * Stripe CLI for anything beyond the upgrade/lapse flows.
 *
 * Control endpoints (not part of Stripe):
 *   POST /__mock/subscriptions/:id/status  {"status":"canceled"|"past_due"|"active"|...}
 *   GET  /__mock/state
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import Stripe from "stripe";

type Json = Record<string, unknown>;

interface State {
  customers: Map<string, Json>;
  sessions: Map<string, Json>;
  subscriptions: Map<string, Json>;
}

export interface MockStripeOptions {
  port?: number;
  webhookUrl?: string;
  webhookSecret?: string;
  /** Host header to send with webhooks (the app routes by Host). */
  webhookHost?: string;
  log?: (msg: string) => void;
}

let counter = 0;
const id = (prefix: string) => `${prefix}_mock${(++counter).toString(36)}${Date.now().toString(36).slice(-4)}`;

/** Parse Stripe's nested form encoding: a[b][0][c]=v -> {a:{b:[{c:v}]}} */
export function parseForm(body: string): Json {
  const out: Json = {};
  for (const [rawKey, value] of new URLSearchParams(body)) {
    const path = rawKey.replace(/\]/g, "").split("[");
    let cur: Record<string, unknown> | unknown[] = out;
    for (let i = 0; i < path.length; i++) {
      const key = path[i];
      const last = i === path.length - 1;
      const nextIsIndex = !last && /^\d+$/.test(path[i + 1]);
      if (Array.isArray(cur)) {
        const idx = Number(key);
        if (last) cur[idx] = value;
        else {
          cur[idx] ??= nextIsIndex ? [] : {};
          cur = cur[idx] as Record<string, unknown>;
        }
      } else {
        if (last) cur[key] = value;
        else {
          cur[key] ??= nextIsIndex ? [] : {};
          cur = cur[key] as Record<string, unknown>;
        }
      }
    }
  }
  return out;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function html(res: ServerResponse, body: string) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><html><body style="font-family:sans-serif;max-width:32rem;margin:4rem auto">${body}</body></html>`);
}

export function startMockStripe(opts: MockStripeOptions = {}) {
  const port = opts.port ?? Number(process.env.MOCK_STRIPE_PORT ?? 4242);
  const webhookUrl = opts.webhookUrl ?? process.env.MOCK_STRIPE_WEBHOOK_URL ?? "http://127.0.0.1:3000/api/stripe/webhook";
  const webhookHost = opts.webhookHost ?? process.env.MOCK_STRIPE_WEBHOOK_HOST ?? "";
  const secret = opts.webhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_mock_secret";
  const log = opts.log ?? ((m: string) => console.log(`[mock-stripe] ${m}`));
  const state: State = { customers: new Map(), sessions: new Map(), subscriptions: new Map() };
  const base = () => `http://127.0.0.1:${port}`;

  async function sendWebhook(type: string, object: Json): Promise<void> {
    const event = {
      id: id("evt"),
      object: "event",
      api_version: "2026-01-01",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 1,
      request: null,
      type,
      data: { object },
    };
    const payload = JSON.stringify(event);
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });
    const headers: Record<string, string> = { "Content-Type": "application/json", "Stripe-Signature": signature };
    if (webhookHost) headers.Host = webhookHost;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const res = await fetch(webhookUrl, { method: "POST", headers, body: payload });
        log(`webhook ${type} -> ${res.status}`);
        if (res.ok) return;
      } catch (err) {
        log(`webhook ${type} failed: ${(err as Error).message}`);
      }
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }

  function makeSubscription(customer: string, metadata: Json, priceId: string): Json {
    const now = Math.floor(Date.now() / 1000);
    const sub: Json = {
      id: id("sub"),
      object: "subscription",
      customer,
      status: "active",
      metadata,
      cancel_at_period_end: false,
      current_period_start: now,
      current_period_end: now + 30 * 24 * 3600,
      items: {
        object: "list",
        data: [{ id: id("si"), object: "subscription_item", price: { id: priceId, object: "price" }, current_period_start: now, current_period_end: now + 30 * 24 * 3600 }],
      },
    };
    state.subscriptions.set(sub.id as string, sub);
    return sub;
  }

  async function setSubscriptionStatus(sub: Json, status: string): Promise<void> {
    sub.status = status;
    if (status === "canceled") {
      sub.canceled_at = Math.floor(Date.now() / 1000);
      await sendWebhook("customer.subscription.deleted", sub);
    } else {
      await sendWebhook("customer.subscription.updated", sub);
    }
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", base());
    const method = req.method ?? "GET";
    const path = url.pathname;
    const rawBody = method === "POST" || method === "DELETE" ? await readBody(req) : "";
    const form = rawBody && (req.headers["content-type"] ?? "").includes("json") ? (JSON.parse(rawBody || "{}") as Json) : parseForm(rawBody);
    let m: RegExpMatchArray | null;

    try {
      // ---- Stripe API -----------------------------------------------------
      if (method === "POST" && path === "/v1/customers") {
        const customer: Json = { id: id("cus"), object: "customer", email: form.email, name: form.name, metadata: form.metadata ?? {} };
        state.customers.set(customer.id as string, customer);
        return json(res, 200, customer);
      }
      if (method === "POST" && path === "/v1/checkout/sessions") {
        const session: Json = {
          id: id("cs"),
          object: "checkout.session",
          mode: form.mode,
          customer: form.customer,
          client_reference_id: form.client_reference_id ?? null,
          metadata: form.metadata ?? {},
          subscription_data: form.subscription_data ?? {},
          line_items: form.line_items ?? [],
          success_url: form.success_url,
          cancel_url: form.cancel_url,
          subscription: null,
          status: "open",
          payment_status: "unpaid",
        };
        session.url = `${base()}/checkout/${session.id}`;
        state.sessions.set(session.id as string, session);
        return json(res, 200, session);
      }
      if (method === "POST" && path === "/v1/billing_portal/sessions") {
        const portal: Json = { id: id("bps"), object: "billing_portal.session", customer: form.customer, return_url: form.return_url };
        portal.url = `${base()}/portal/${form.customer}?return_url=${encodeURIComponent(String(form.return_url ?? ""))}`;
        return json(res, 200, portal);
      }
      if ((m = path.match(/^\/v1\/subscriptions\/([^/]+)$/))) {
        const sub = state.subscriptions.get(m[1]);
        if (!sub) return json(res, 404, { error: { type: "invalid_request_error", message: `No such subscription: ${m[1]}` } });
        if (method === "GET") return json(res, 200, sub);
        if (method === "DELETE") {
          await setSubscriptionStatus(sub, "canceled");
          return json(res, 200, sub);
        }
        if (method === "POST") {
          if (form.cancel_at_period_end !== undefined) sub.cancel_at_period_end = form.cancel_at_period_end === "true";
          if (form.metadata) sub.metadata = { ...(sub.metadata as Json), ...(form.metadata as Json) };
          await sendWebhook("customer.subscription.updated", sub);
          return json(res, 200, sub);
        }
      }
      if ((m = path.match(/^\/v1\/checkout\/sessions\/([^/]+)$/)) && method === "GET") {
        const s = state.sessions.get(m[1]);
        return s ? json(res, 200, s) : json(res, 404, { error: { message: "No such session" } });
      }

      // ---- Hosted pages (what a user would see on stripe.com) -------------
      if ((m = path.match(/^\/checkout\/([^/]+)$/)) && method === "GET") {
        const s = state.sessions.get(m[1]);
        if (!s) return html(res, "<h1>Unknown checkout session</h1>");
        return html(
          res,
          `<h1>Mock Stripe Checkout</h1><p>Subscribe to <strong>${(s.line_items as Json[])?.[0]?.price ?? "plan"}</strong> as customer ${s.customer}.</p>
           <form method="post" action="/checkout/${s.id}/complete"><button type="submit" id="pay" style="padding:.75rem 1.5rem;font-size:1rem">Pay (test card)</button></form>
           <p><a href="${s.cancel_url}">Cancel</a></p>`,
        );
      }
      if ((m = path.match(/^\/checkout\/([^/]+)\/complete$/)) && method === "POST") {
        const s = state.sessions.get(m[1]);
        if (!s) return json(res, 404, { error: "unknown session" });
        const metadata = { ...(((s.subscription_data as Json)?.metadata as Json) ?? {}), ...((s.metadata as Json) ?? {}) };
        const priceId = String((s.line_items as Json[])?.[0]?.price ?? "price_mock");
        const sub = makeSubscription(String(s.customer), metadata, priceId);
        s.subscription = sub.id;
        s.status = "complete";
        s.payment_status = "paid";
        await sendWebhook("customer.subscription.created", sub);
        await sendWebhook("checkout.session.completed", s);
        res.writeHead(303, { Location: String(s.success_url) });
        return res.end();
      }
      if ((m = path.match(/^\/portal\/([^/]+)$/)) && method === "GET") {
        const customer = m[1];
        const subs = [...state.subscriptions.values()].filter((s) => s.customer === customer);
        const returnUrl = url.searchParams.get("return_url") ?? "/";
        return html(
          res,
          `<h1>Mock Billing Portal</h1><p>Customer ${customer}</p>
           <ul>${subs.map((s) => `<li>${s.id}: <strong>${s.status}</strong>${s.status !== "canceled" ? ` <form style="display:inline" method="post" action="/portal/${customer}/cancel?sub=${s.id}&return_url=${encodeURIComponent(returnUrl)}"><button id="cancel-${s.id}" class="cancel">Cancel subscription</button></form>` : ""}</li>`).join("")}</ul>
           <p><a id="return" href="${returnUrl}">Return to site</a></p>`,
        );
      }
      if ((m = path.match(/^\/portal\/([^/]+)\/cancel$/)) && method === "POST") {
        const sub = state.subscriptions.get(url.searchParams.get("sub") ?? "");
        if (sub) await setSubscriptionStatus(sub, "canceled");
        res.writeHead(303, { Location: url.searchParams.get("return_url") ?? "/" });
        return res.end();
      }

      // ---- Control endpoints ------------------------------------------------
      if ((m = path.match(/^\/__mock\/subscriptions\/([^/]+)\/status$/)) && method === "POST") {
        const sub = state.subscriptions.get(m[1]);
        if (!sub) return json(res, 404, { error: "unknown subscription" });
        await setSubscriptionStatus(sub, String(form.status ?? "canceled"));
        return json(res, 200, sub);
      }
      if (path === "/__mock/state" && method === "GET") {
        return json(res, 200, {
          customers: [...state.customers.values()],
          sessions: [...state.sessions.values()],
          subscriptions: [...state.subscriptions.values()],
        });
      }
      if (path === "/__mock/reset" && method === "POST") {
        state.customers.clear();
        state.sessions.clear();
        state.subscriptions.clear();
        return json(res, 200, { ok: true });
      }
      return json(res, 404, { error: { type: "invalid_request_error", message: `Unrecognized request URL (${method}: ${path})` } });
    } catch (err) {
      log(`error handling ${method} ${path}: ${(err as Error).stack}`);
      return json(res, 500, { error: { message: (err as Error).message } });
    }
  });

  server.listen(port, "127.0.0.1", () => log(`listening on ${base()} (webhooks -> ${webhookUrl})`));
  return { server, state, port };
}

if (process.argv[1] && /mocks[\\/]stripe\.ts$/.test(process.argv[1])) {
  startMockStripe();
}
