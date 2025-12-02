import stripe

from app.core.config import settings
from app.core.supabase import get_supabase_client


stripe.api_key = settings.STRIPE_SECRET_KEY


class StripeService:
  def __init__(self):
    self.supabase = get_supabase_client()

  async def create_customer(self, user_id: str, email: str) -> str:
    """Create Stripe customer and link to user profile."""
    customer = stripe.Customer.create(
      email=email,
      metadata={"user_id": user_id},
    )

    self.supabase.table("profiles").update(
      {"stripe_customer_id": customer.id},
    ).eq("id", user_id).execute()

    return customer.id

  async def create_checkout_session(
    self,
    user_id: str,
    price_id: str,
    success_url: str,
    cancel_url: str,
  ) -> str:
    """Create Stripe Checkout session for subscription."""
    profile = (
      self.supabase.table("profiles")
      .select("stripe_customer_id, email")
      .eq("id", user_id)
      .single()
      .execute()
    )

    customer_id = profile.data.get("stripe_customer_id")
    if not customer_id:
      customer_id = await self.create_customer(user_id, profile.data["email"])

    session = stripe.checkout.Session.create(
      customer=customer_id,
      payment_method_types=["card"],
      line_items=[{"price": price_id, "quantity": 1}],
      mode="subscription",
      success_url=success_url,
      cancel_url=cancel_url,
      metadata={"user_id": user_id},
    )

    return session.url

  async def create_portal_session(self, user_id: str, return_url: str) -> str:
    """Create Stripe customer portal session for managing subscription."""
    profile = (
      self.supabase.table("profiles")
      .select("stripe_customer_id")
      .eq("id", user_id)
      .single()
      .execute()
    )

    if not profile.data.get("stripe_customer_id"):
      raise ValueError("No Stripe customer found")

    session = stripe.billing_portal.Session.create(
      customer=profile.data["stripe_customer_id"],
      return_url=return_url,
    )

    return session.url


