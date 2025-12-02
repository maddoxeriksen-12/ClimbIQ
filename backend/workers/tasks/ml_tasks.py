import asyncio

from workers.celery_app import celery_app
from app.core.supabase import get_supabase_client
from app.services.causal_inference_service import CausalInferenceService


@celery_app.task(name="update_user_model")
def update_user_model(user_id: str):
  """
  Triggered after session completion to update user's personalized model.
  Runs async code from a Celery worker.
  """
  loop = asyncio.new_event_loop()
  asyncio.set_event_loop(loop)

  try:
    result = loop.run_until_complete(_update_model(user_id))
    return result
  finally:
    loop.close()


async def _update_model(user_id: str):
  supabase = get_supabase_client()
  causal_service = CausalInferenceService()

  sessions = (
    supabase.table("climbing_sessions")
    .select("*")
    .eq("user_id", user_id)
    .order("session_date", desc=True)
    .limit(100)
    .execute()
  )

  if len(sessions.data) < 10:
    return {"status": "insufficient_data", "sessions": len(sessions.data)}

  # Placeholder: here we'd retrain/update a model in MLflow.
  _ = causal_service  # avoid unused variable warning

  return {"status": "model_updated", "sessions_used": len(sessions.data)}


@celery_app.task(name="batch_generate_recommendations")
def batch_generate_recommendations():
  """
  Scheduled task to generate recommendations for all active users.
  """
  supabase = get_supabase_client()

  active_users = (
    supabase.table("profiles")
    .select("id")
    .eq("subscription_status", "active")
    .execute()
  )

  for user in active_users.data:
    generate_user_recommendations.delay(user["id"])

  return {"users_queued": len(active_users.data)}


@celery_app.task(name="generate_user_recommendations")
def generate_user_recommendations(user_id: str):
  """Generate recommendations for a single user."""
  from app.services.recommendation_service import RecommendationService

  loop = asyncio.new_event_loop()
  asyncio.set_event_loop(loop)

  try:
    service = RecommendationService()
    result = loop.run_until_complete(
      service.generate_pre_session_recommendations(user_id),
    )
    return {"user_id": user_id, "recommendations": len(result)}
  finally:
    loop.close()


