from typing import Optional, Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_user
from app.core.supabase import get_supabase_client
from app.services.recommendation_service import RecommendationService
from app.services.explanation_service import get_explanation_service
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
    #    Frontend: 1 = debilitating (bad), 10 = barely noticeable (good)
    #    Backend expects: high value = more sore (bad)
    if "muscle_soreness" not in user_state and "doms_severity" in user_state:
        doms = user_state["doms_severity"]
        if isinstance(doms, (int, float)):
            # Invert: frontend high (good) -> backend low (good)
            user_state["muscle_soreness"] = max(1, 11 - int(doms))

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

    # 6) Basic warmup completion proxy: treat any explicit compliance other than
    #    "failed" as a completed warmup (even if some parts were skipped).
    if "warmup_completed" not in user_state and "warmup_compliance" in user_state:
        compliance = user_state["warmup_compliance"]
        if isinstance(compliance, str) and compliance in ("exact", "skipped", "modified_pain", "own_routine"):
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

    # 8) Stress level: invert for backend rules
    #    Frontend: 1 = anxious/stressed (bad), 10 = zen/relaxed (good)
    #    Backend expects: high value = more stressed (bad)
    if "stress_level" in user_state:
        stress = user_state["stress_level"]
        if isinstance(stress, (int, float)):
            # Invert: frontend high (calm) -> backend low (calm)
            user_state["stress_level"] = max(1, 11 - int(stress))

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


# --- Explanation ("Why?") endpoints ---

class ExplanationRequest(BaseModel):
    """Request for explanation of a recommendation."""
    recommendation_type: str  # warmup, session_structure, rest, intensity, avoid, include
    target_element: Optional[str] = None  # extended_warmup, long_rests, etc.
    recommendation_message: str  # The actual recommendation text
    user_state: Dict[str, Any]  # Current user state variables
    key_factors: Optional[List[Dict[str, Any]]] = None  # Key factors from recommendation


class ExplanationFeedbackRequest(BaseModel):
    """Feedback on an explanation."""
    recommendation_type: str
    explanation_shown: Dict[str, Any]
    was_helpful: bool
    clarity_rating: Optional[int] = None  # 1-5
    feedback_text: Optional[str] = None
    session_id: Optional[str] = None
    explanation_id: Optional[str] = None
    cache_id: Optional[str] = None


@router.post("/recommendations/explain")
async def get_explanation(
    request: ExplanationRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Get an explanation for why a specific recommendation was made.

    Uses template matching first, then falls back to Grok LLM for complex cases.
    Explanations are cached for reuse.
    """
    service = get_explanation_service()

    # Normalize user_state from frontend to match engine semantics so that
    # templates and LLM see the same meaning as the recommendation engine.
    raw_state = dict(request.user_state or {})
    user_state: Dict[str, Any] = {k: v for k, v in raw_state.items() if v is not None}

    # Hydration: hydration_feel (dehydrated/neutral/well_hydrated) -> hydration_status (1-10)
    if "hydration_status" not in user_state and "hydration_feel" in user_state:
        hydration_map = {
            "dehydrated": 3,
            "neutral": 7,
            "well_hydrated": 9,
        }
        feel = user_state.get("hydration_feel")
        if isinstance(feel, str):
            user_state["hydration_status"] = hydration_map.get(feel, 7)

    # DOMS: frontend 1 = debilitating (bad), 10 = barely noticeable (good)
    # Explanation templates expect muscle_soreness where higher = more sore (bad).
    if "muscle_soreness" not in user_state and "doms_severity" in user_state:
        doms = user_state["doms_severity"]
        if isinstance(doms, (int, float)):
            user_state["muscle_soreness"] = max(1, 11 - int(doms))

    # Energy: derive from upper_body_power & leg_springiness if available
    if "energy_level" not in user_state:
        ub = user_state.get("upper_body_power")
        leg = user_state.get("leg_springiness")
        if isinstance(ub, (int, float)) and isinstance(leg, (int, float)):
            user_state["energy_level"] = round((ub + leg) / 2)

    # Motivation: keep motivation and motivation_level in sync
    if "motivation" in user_state and "motivation_level" not in user_state:
        user_state["motivation_level"] = user_state["motivation"]
    elif "motivation_level" in user_state and "motivation" not in user_state:
        user_state["motivation"] = user_state["motivation_level"]

    # Finger health: map finger_tendon_health into injury_severity proxy
    if "injury_severity" not in user_state and "finger_tendon_health" in user_state:
        fth = user_state["finger_tendon_health"]
        if isinstance(fth, (int, float)):
            user_state["injury_severity"] = max(0, 10 - int(fth))

    # Warmup completion: treat all explicit compliance states except "failed"
    # as a completed warmup so we don't overstate "skipped warmup".
    if "warmup_completed" not in user_state and "warmup_compliance" in user_state:
        compliance = user_state["warmup_compliance"]
        if isinstance(compliance, str) and compliance in ("exact", "skipped", "modified_pain", "own_routine"):
            user_state["warmup_completed"] = True

        # Also soften wording passed to the explanation LLM/templates so "skipped"
        # is not interpreted as doing no warmup at all.
        if compliance == "skipped":
            user_state["warmup_compliance"] = "completed_warmup_with_minor_skips"

    # Skin condition: map string to numeric scale for templates if present
    if "skin_condition" in user_state and isinstance(user_state["skin_condition"], str):
        skin_map = {
            "fresh": 9,
            "pink": 7,
            "dry": 6,
            "sweaty": 5,
            "split": 3,
            "worn": 2,
        }
        user_state["skin_condition"] = skin_map.get(user_state["skin_condition"], 5)

    # Stress: frontend 1 = anxious/stressed, 10 = zen/relaxed.
    # Explanation templates expect higher stress_level = more stressed.
    if "stress_level" in user_state:
        stress = user_state["stress_level"]
        if isinstance(stress, (int, float)):
            user_state["stress_level"] = max(1, 11 - int(stress))

    explanation = await service.get_explanation(
        recommendation_type=request.recommendation_type,
        target_element=request.target_element,
        recommendation_message=request.recommendation_message,
        user_state=user_state,
        key_factors=request.key_factors or [],
    )

    return {
        "success": True,
        "explanation": explanation,
    }


@router.post("/recommendations/explain/feedback")
async def submit_explanation_feedback(
    request: ExplanationFeedbackRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Submit feedback on an explanation to improve future explanations.
    """
    service = get_explanation_service()

    result = await service.submit_feedback(
        user_id=current_user["id"],
        recommendation_type=request.recommendation_type,
        explanation_shown=request.explanation_shown,
        was_helpful=request.was_helpful,
        clarity_rating=request.clarity_rating,
        feedback_text=request.feedback_text,
        session_id=request.session_id,
        explanation_id=request.explanation_id,
        cache_id=request.cache_id,
    )

    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to submit feedback"))

    return result


@router.get("/recommendations/explanations/templates")
async def get_explanation_templates(
    recommendation_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """
    Get available explanation templates (for admin/debugging).
    """
    supabase = get_supabase_client()

    query = supabase.table("recommendation_explanations").select(
        "id, recommendation_type, target_element, condition_pattern, "
        "short_explanation, factors_explained, confidence, priority, usage_count, "
        "positive_feedback_count, negative_feedback_count"
    ).eq("is_active", True)

    if recommendation_type:
        query = query.eq("recommendation_type", recommendation_type)

    result = query.order("priority", desc=True).execute()

    return {
        "templates": result.data or [],
        "count": len(result.data or []),
    }
