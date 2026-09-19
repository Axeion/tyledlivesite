import { NextResponse, type NextRequest } from "next/server";
import { constructWebhookEvent, handleStripeEvent } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new NextResponse("Missing signature", { status: 400 });
  const raw = await req.text();
  let event;
  try {
    event = constructWebhookEvent(raw, signature);
  } catch (err) {
    return new NextResponse(`Invalid signature: ${(err as Error).message}`, { status: 400 });
  }
  try {
    const applied = await handleStripeEvent(event);
    return NextResponse.json({ received: true, applied });
  } catch (err) {
    console.error("[stripe] webhook handling failed", err);
    return new NextResponse("Webhook handler error", { status: 500 });
  }
}
