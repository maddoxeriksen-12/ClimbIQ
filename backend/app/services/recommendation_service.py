from datetime import datetime, timedelta
from typing import List

from app.core.supabase import get_supabase_client
from app.services.causal_inference_service import CausalInferenceService


class RecommendationService:
  def __init__(self):
    self.supabase = get_supabase_client()
    self.causal_service = CausalInferenceService()

  async def generate_pre_session_recommendations(
    self,
    user_id: str,
  ) -> List[dict]:
    """Generate personalized pre-session recommendations using causal inference."""

    # 1. Get user's historical data
    user_data = await self._get_user_data(user_id)

    if len(user_data["sessions"]) < 10:
      # Not enough data for personalized recommendations
      return await self._get_population_recommendations()

    # 2. Get current context (recent sessions, recovery status)
    current_context = await self._get_current_context(user_id)

    # 3. Run causal inference to find optimal interventions
    recommendations = await self.causal_service.get_optimal_interventions(
      user_data=user_data,
      current_context=current_context,
    )

    # 4. Store recommendations
    stored_recs = []
    for rec in recommendations:
      result = self.supabase.table("recommendations").insert(
        {
          "user_id": user_id,
          "recommendation_type": "pre_session",
          "title": rec["title"],
          "description": rec["description"],
          "reasoning": rec["reasoning"],
          "model_version": rec.get("model_version"),
          "confidence_score": rec.get("confidence_score"),
          "causal_factors": rec.get("causal_factors", {}),
          "expected_effect": rec.get("expected_effect", {}),
          "valid_until": (
            datetime.now() + timedelta(hours=24)
          ).isoformat(),
        }
      ).execute()
      stored_recs.append(result.data[0])

    return stored_recs

  async def _get_user_data(self, user_id: str) -> dict:
    """Fetch all relevant user data for ML."""

    # Sessions with climbs
    sessions = (
      self.supabase.table("climbing_sessions")
      .select("*, climbs(*)")
      .eq("user_id", user_id)
      .order("session_date", desc=True)
      .limit(100)
      .execute()
    )

    # Nutrition logs
    nutrition = (
      self.supabase.table("nutrition_logs")
      .select("*")
      .eq("user_id", user_id)
      .order("logged_at", desc=True)
      .limit(200)
      .execute()
    )

    # Training logs
    training = (
      self.supabase.table("training_logs")
      .select("*")
      .eq("user_id", user_id)
      .order("logged_at", desc=True)
      .limit(100)
      .execute()
    )

    # Recovery logs
    recovery = (
      self.supabase.table("recovery_logs")
      .select("*")
      .eq("user_id", user_id)
      .order("logged_at", desc=True)
      .limit(100)
      .execute()
    )

    # Past recommendations and feedback
    past_recs = (
      self.supabase.table("recommendations")
      .select("*")
      .eq("user_id", user_id)
      .not_.is_("was_followed", "null")
      .order("created_at", desc=True)
      .limit(50)
      .execute()
    )

    return {
      "sessions": sessions.data,
      "nutrition": nutrition.data,
      "training": training.data,
      "recovery": recovery.data,
      "past_recommendations": past_recs.data,
    }

  async def _get_current_context(self, user_id: str) -> dict:
    """Get user's current state."""

    # Last session
    last_session = (
      self.supabase.table("climbing_sessions")
      .select("*")
      .eq("user_id", user_id)
      .order("session_date", desc=True)
      .limit(1)
      .execute()
    )

    # Days since last session
    days_since = None
    if last_session.data:
      last_date = datetime.fromisoformat(last_session.data[0]["session_date"])
      days_since = (datetime.now().date() - last_date.date()).days

    # Recent nutrition
    recent_nutrition = (
      self.supabase.table("nutrition_logs")
      .select("*")
      .eq("user_id", user_id)
      .gte("logged_at", (datetime.now() - timedelta(hours=24)).isoformat())
      .execute()
    )

    return {
      "last_session": last_session.data[0] if last_session.data else None,
      "days_since_last_session": days_since,
      "recent_nutrition": recent_nutrition.data,
    }

  async def _get_population_recommendations(self) -> List[dict]:
    """Return evidence-based recommendations for new users."""
    return [
      {
        "title": "Warm up progressively",
        "description": "Start 3-4 grades below your max and work up over 20-30 minutes",
        "reasoning": "Research shows progressive warm-up reduces injury risk by 50%",
        "model_version": "population_baseline",
        "confidence_score": 0.85,
      },
      {
        "title": "Stay hydrated",
        "description": "Drink 500ml water in the 2 hours before your session",
        "reasoning": "Dehydration impairs grip strength and cognitive function",
        "model_version": "population_baseline",
        "confidence_score": 0.90,
      },
    ]


