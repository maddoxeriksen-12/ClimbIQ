import asyncio
import json
from datetime import datetime

from workers.celery_app import celery_app
from app.core.supabase import get_supabase_client


@celery_app.task(name="update_user_model")
def update_user_model(user_id: str):
  """
  Triggered after session completion to update user's personalized model.
  Uses quick incremental update for low latency.
  Full training happens nightly via Dagster.
  """
  loop = asyncio.new_event_loop()
  asyncio.set_event_loop(loop)

  try:
    result = loop.run_until_complete(_update_model(user_id))
    return result
  finally:
    loop.close()


async def _update_model(user_id: str):
  """
  Quick model update after session completion.
  
  Strategy for low latency:
  1. Check if user has existing model_outputs
  2. If cold_start (<10 sessions): use population priors
  3. If learning (10-30): quick incremental update
  4. Full Bayesian training happens nightly via Dagster
  """
  supabase = get_supabase_client()

  # Get user's completed sessions with quality ratings
  sessions = (
    supabase.table("climbing_sessions")
    .select("id, session_quality, pre_session_data, post_session_data, deviated_from_plan, "
            "actual_caffeine_mg, planned_caffeine_mg, sleep_hours, stress_level, energy_level")
    .eq("user_id", user_id)
    .eq("status", "completed")
    .not_.is_("session_quality", "null")
    .order("started_at", desc=True)
    .limit(50)
    .execute()
  )

  n_sessions = len(sessions.data) if sessions.data else 0
  
  if n_sessions < 3:
    return {"status": "insufficient_data", "sessions": n_sessions, "phase": "cold_start"}

  # Determine phase
  if n_sessions < 10:
    phase = "cold_start"
  elif n_sessions < 30:
    phase = "learning"
  else:
    phase = "personalized"

  # Get existing model or create new
  model_result = (
    supabase.table("model_outputs")
    .select("*")
    .eq("user_id", user_id)
    .execute()
  )

  existing_model = model_result.data[0] if model_result.data else None

  # Quick update: compute simple shrinkage-based coefficients
  # Full Bayesian update happens nightly
  coefficients = _compute_quick_coefficients(sessions.data, existing_model)
  shrinkage = min(0.9, n_sessions / 50)

  model_data = {
    "user_id": user_id,
    "coefficients": coefficients,
    "confidence_intervals": {},  # Full CIs computed nightly
    "sessions_included": n_sessions,
    "phase": phase,
    "shrinkage_factor": float(shrinkage),
    "last_trained_at": datetime.utcnow().isoformat(),
    "model_version": "quick_update_v1"
  }

  # Upsert model outputs
  supabase.table("model_outputs").upsert(
    model_data,
    on_conflict="user_id"
  ).execute()

  return {
    "status": "model_updated",
    "sessions_used": n_sessions,
    "phase": phase,
    "shrinkage_factor": shrinkage
  }


def _compute_quick_coefficients(sessions: list, existing_model: dict = None) -> dict:
  """
  Quick coefficient estimation using weighted averaging.
  Full hierarchical Bayesian training runs nightly via Dagster.
  """
  import numpy as np
  
  # Load population priors as baseline
  supabase = get_supabase_client()
  priors_result = supabase.table("population_priors").select("variable_name, population_mean").execute()
  
  priors = {p["variable_name"]: p["population_mean"] for p in (priors_result.data or [])}
  
  # Start with population priors or existing model
  if existing_model and existing_model.get("coefficients"):
    coefficients = dict(existing_model["coefficients"])
  else:
    coefficients = {
      "intercept": 5.0,
      "sleep_hours": priors.get("sleep_hours", 0.15),
      "sleep_quality": priors.get("sleep_quality", 0.40),
      "stress_level": priors.get("stress_level", -0.35),
      "energy_level": priors.get("energy_level", 0.45),
      "caffeine_mg": priors.get("caffeine_mg", 0.003),
      "days_since_hard_session": priors.get("days_since_hard_session", 0.30),
    }
  
  # If enough sessions, compute simple empirical adjustments
  if len(sessions) >= 5:
    qualities = []
    for s in sessions:
      q = s.get("session_quality")
      if q is not None:
        qualities.append(q)
    
    if qualities:
      # Adjust intercept toward user's mean quality
      user_mean = np.mean(qualities)
      pop_mean = 5.0
      adjustment = (user_mean - pop_mean) * 0.3  # Partial adjustment
      coefficients["intercept"] = float(pop_mean + adjustment)
  
  return coefficients


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


