from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_user
from app.core.supabase import get_supabase_client
from app.services.recommendation_service import RecommendationService
from app.api.routes.recommendation_core.recommendation_engine import RecommendationEngine


router = APIRouter()


# Cache the recommendation engine instance
_engine_instance: Optional[RecommendationEngine] = None

def get_recommendation_engine() -> RecommendationEngine:
    """Get or create the recommendation engine singleton"""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = RecommendationEngine(get_supabase_client())
    return _engine_instance


class RecommendationFeedback(BaseModel):
    was_followed: bool
    rating: Optional[int] = None
    feedback: Optional[str] = None
    outcome_data: Optional[dict] = None


class PreSessionData(BaseModel):
    """Pre-session state data for generating recommendations"""
    # Sleep & Recovery
    sleep_hours: Optional[float] = None
    sleep_quality: Optional[int] = None
    days_since_rest_day: Optional[int] = None
    days_since_last_session: Optional[int] = None
    
    # Physical Readiness
    muscle_soreness: Optional[int] = None
    energy_level: Optional[int] = None
    hydration_status: Optional[int] = None
    hours_since_meal: Optional[float] = None
    
    # Injury
    injury_severity: Optional[int] = None
    finger_injury_present: Optional[bool] = None
    pulley_injury_grade: Optional[int] = None
    
    # Psychological
    stress_level: Optional[int] = None
    motivation_level: Optional[int] = None
    performance_anxiety: Optional[int] = None
    fear_of_falling: Optional[int] = None
    self_efficacy: Optional[int] = None
    
    # Substances
    caffeine_today: Optional[bool] = None
    caffeine_habitual: Optional[bool] = None
    alcohol_last_24h: Optional[bool] = None
    
    # Training Load
    weekly_climbing_hours: Optional[float] = None
    training_load_change: Optional[float] = None
    
    # Session Context
    warmup_completed: Optional[bool] = None
    warmup_duration_min: Optional[int] = None
    
    # Climbing-specific
    skin_condition: Optional[int] = None
    
    class Config:
        extra = "allow"  # Allow additional fields


@router.post("/recommendations/generate")
async def generate_recommendation(
    pre_session: PreSessionData,
    current_user: dict = Depends(get_current_user),
):
    """
    Generate a personalized climbing session recommendation based on pre-session state.
    
    Uses Bayesian priors derived from literature and expert judgments to predict
    session quality and recommend appropriate session types.
    """
    engine = get_recommendation_engine()
    
    # Convert to dict, excluding None values
    user_state = {k: v for k, v in pre_session.model_dump().items() if v is not None}
    
    # Generate recommendation
    recommendation = engine.generate_recommendation(user_state)
    
    # Add user context
    recommendation["user_id"] = current_user["id"]
    
    return recommendation


@router.get("/recommendations/priors")
async def get_priors_summary(
    current_user: dict = Depends(get_current_user),
):
    """Get summary of population priors used by the recommendation engine."""
    engine = get_recommendation_engine()
    return engine.get_priors_summary()


@router.get("/recommendations/rules")
async def get_rules_summary(
    current_user: dict = Depends(get_current_user),
):
    """Get summary of expert rules used by the recommendation engine."""
    engine = get_recommendation_engine()
    return engine.get_rules_summary()


@router.get("/recommendations/pre-session")
async def get_pre_session_recommendations(
    current_user: dict = Depends(get_current_user),
):
    """Get personalized recommendations before a climbing session."""
    service = RecommendationService()
    recommendations = await service.generate_pre_session_recommendations(
        user_id=current_user["id"],
    )
    return recommendations


@router.get("/recommendations")
async def get_recommendations(
  recommendation_type: Optional[str] = None,
  limit: int = 10,
  current_user: dict = Depends(get_current_user),
):
  supabase = get_supabase_client()

  query = (
    supabase.table("recommendations")
    .select("*")
    .eq("user_id", current_user["id"])
    .order("created_at", desc=True)
    .limit(limit)
  )

  if recommendation_type:
    query = query.eq("recommendation_type", recommendation_type)

  result = query.execute()
  return result.data


@router.patch("/recommendations/{recommendation_id}/feedback")
async def submit_feedback(
  recommendation_id: str,
  feedback: RecommendationFeedback,
  current_user: dict = Depends(get_current_user),
):
  supabase = get_supabase_client()

  data = {
    "was_followed": feedback.was_followed,
    "user_rating": feedback.rating,
    "user_feedback": feedback.feedback,
    "outcome_data": feedback.outcome_data,
  }

  result = (
    supabase.table("recommendations")
    .update(data)
    .eq("id", recommendation_id)
    .eq("user_id", current_user["id"])
    .execute()
  )

  if not result.data:
    raise HTTPException(status_code=404, detail="Recommendation not found")

  return result.data[0]


