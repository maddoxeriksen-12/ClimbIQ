from fastapi import APIRouter, HTTPException, Request
import stripe

from app.core.config import settings


router = APIRouter()

stripe.api_key = settings.STRIPE_SECRET_KEY


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
  payload = await request.body()
  sig_header = request.headers.get("stripe-signature")

  try:
    event = stripe.Webhook.construct_event(
      payload,
      sig_header,
      settings.STRIPE_WEBHOOK_SECRET,
    )
  except ValueError:
    raise HTTPException(status_code=400, detail="Invalid payload")
  except stripe.error.SignatureVerificationError:
    raise HTTPException(status_code=400, detail="Invalid signature")

  # Backup/auxiliary processing; primary handling is in Supabase Edge Function.
  return {"received": True, "type": event["type"]}


