import Stripe from "https://esm.sh/stripe@14?target=denonext"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Stripe client configured for Supabase Edge (Deno)
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
})

console.log("Connecting to Supabase:", Deno.env.get("SUPABASE_URL"))

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
)

// Safely convert Stripe Unix timestamp (seconds) to ISO string or null
const toIso = (ts: number | null | undefined) =>
  typeof ts === "number" ? new Date(ts * 1000).toISOString() : null

Deno.serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature")
  const body = await req.text()

  if (!signature) {
    console.error("No Stripe-Signature header")
    return new Response("Webhook Error: No Stripe-Signature header", {
      status: 400,
    })
  }

  let event: Stripe.Event

  // Verify signature using Stripe's async helper (works with SubtleCrypto in Edge)
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
    )
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  console.log("✅ Received event:", event.type)
  console.log("Event data:", JSON.stringify(event.data.object, null, 2))

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription

      console.log("Processing subscription:", subscription.id)
      console.log("Metadata:", subscription.metadata)

      let userId = (subscription.metadata as any)?.user_id || null

      // TEMP TEST FALLBACK: hard-coded user for testing
      if (!userId) userId = "57743ec8-b13e-4b17-a321-6d61ef048cbe"

      if (!userId) {
        console.log("⚠️ No user_id in metadata - skipping subscription upsert")
        break
      }

      const subscriptionData = {
        stripe_subscription_id: subscription.id,
        user_id: userId,
        stripe_price_id: subscription.items.data[0]?.price.id ?? null,
        status: subscription.status,
        current_period_start: toIso(subscription.current_period_start as any),
        current_period_end: toIso(subscription.current_period_end as any),
        cancel_at_period_end: subscription.cancel_at_period_end,
      }

      console.log("Inserting subscription:", subscriptionData)

      const { data, error } = await supabase
        .from("subscriptions")
        // One row per user; update existing row for this user if present
        .upsert(subscriptionData, { onConflict: "user_id" })
        .select()

      if (error) {
        console.error("❌ Subscription upsert error:", error)
      } else {
        console.log("✅ Subscription upserted:", data)
      }

      break
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription

      console.log("Deleting subscription:", subscription.id)

      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("stripe_subscription_id", subscription.id)

      if (error) {
        console.error("❌ Subscription delete error:", error)
      } else {
        console.log("✅ Subscription marked as canceled")
      }

      break
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice
      console.log("Payment succeeded for invoice:", invoice.id)
      break
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice
      console.error("Payment failed for invoice:", invoice.id)
      break
    }

    default:
      console.log("Unhandled event type:", event.type)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  })
})