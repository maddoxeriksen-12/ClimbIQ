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
    skin_condition: Optional[str] = None  # String values: fresh, pink, split, sweaty, dry, worn

    # --- Additional frontend survey variables (allowed via extra="allow") ---
    # These fields are explicitly documented here for clarity but are not
    # strictly required for validation, since `extra = "allow"` is enabled.
    # They are mapped into the core engine variables in the route below.
    session_environment: Optional[str] = None
    planned_duration: Optional[int] = None
    partner_status: Optional[str] = None
    crowdedness: Optional[int] = None
    fueling_status: Optional[str] = None
    hydration_feel: Optional[str] = None
    finger_tendon_health: Optional[int] = None
    doms_locations: Optional[list] = None
    doms_severity: Optional[int] = None
    menstrual_phase: Optional[str] = None
    motivation: Optional[int] = None
    primary_goal: Optional[str] = None
    warmup_rpe: Optional[str] = None
    warmup_compliance: Optional[str] = None
    upper_body_power: Optional[int] = None
    shoulder_integrity: Optional[int] = None
    leg_springiness: Optional[int] = None
    finger_strength: Optional[int] = None
    
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
    raw_state = pre_session.model_dump()
    user_state = {k: v for k, v in raw_state.items() if v is not None}

    # ------------------------------------------------------------------
    # Map rich frontend survey variables into the core engine features.
    # This is where we translate UI-specific fields into the variables
    # that the Bayesian priors and rules actually understand.
    # ------------------------------------------------------------------

    # 1) Hydration: map string "hydration_feel" -> numeric "hydration_status"
    if "hydration_status" not in user_state and "hydration_feel" in user_state:
        hydration_map = {
            "dehydrated": 3,       # clearly suboptimal
            "neutral": 7,          # okay
            "well_hydrated": 9,    # ideal
        }
        feel = user_state.get("hydration_feel")
        if isinstance(feel, str):
            user_state["hydration_status"] = hydration_map.get(feel, 7)

    # 2) Muscle soreness: map DOMS severity -> "muscle_soreness" scale
    if "muscle_soreness" not in user_state and "doms_severity" in user_state:
        # doms_severity is already 1–10 in the UI; treat it directly
        user_state["muscle_soreness"] = user_state["doms_severity"]

    # 3) Energy level: derive from upper_body_power & leg_springiness if present
    if "energy_level" not in user_state:
        ub = user_state.get("upper_body_power")
        leg = user_state.get("leg_springiness")
        if isinstance(ub, (int, float)) and isinstance(leg, (int, float)):
            user_state["energy_level"] = round((ub + leg) / 2)

    # 4) Motivation: ensure both "motivation" (for priors) and "motivation_level"
    #    (for session-type rules) are populated.
    if "motivation" in user_state and "motivation_level" not in user_state:
        user_state["motivation_level"] = user_state["motivation"]
    elif "motivation_level" in user_state and "motivation" not in user_state:
        user_state["motivation"] = user_state["motivation_level"]

    # 5) Finger health: map finger_tendon_health into injury_severity proxy
    if "injury_severity" not in user_state and "finger_tendon_health" in user_state:
        # Lower tendon health -> higher injury severity (inverse relationship)
        fth = user_state["finger_tendon_health"]
        if isinstance(fth, (int, float)):
            user_state["injury_severity"] = max(0, 10 - int(fth))

    # 6) Basic warmup completion proxy: if a personalized warmup was generated
    #    and compliance is "exact", treat warmup as completed.
    if "warmup_completed" not in user_state and "warmup_compliance" in user_state:
        compliance = user_state["warmup_compliance"]
        if isinstance(compliance, str) and compliance in ("exact", "modified_pain", "own_routine"):
            user_state["warmup_completed"] = True

    # 7) Skin condition: map string values to numeric scale (1-10)
    if "skin_condition" in user_state and isinstance(user_state["skin_condition"], str):
        skin_map = {
            "fresh": 9,      # optimal - thick, healthy skin
            "pink": 7,       # good - slightly worn but fine
            "dry": 6,        # okay - may need moisturizing
            "sweaty": 5,     # suboptimal - grip issues
            "split": 3,      # poor - needs taping
            "worn": 2,       # poor - painful, risk of injury
        }
        user_state["skin_condition"] = skin_map.get(user_state["skin_condition"], 5)

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


